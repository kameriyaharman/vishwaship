<?php
// Vishwaship API entry point. Works with PHP built-in server, Apache (.htaccess) or Hostinger.
declare(strict_types=1);
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');
date_default_timezone_set('Asia/Kolkata');

require __DIR__ . '/lib.php';
require __DIR__ . '/migrate.php';

// ---- CORS ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
$allowed = array_filter(array_map('trim', explode(',', env('CORS_ORIGINS', '*'))));
if (in_array('*', $allowed) || in_array($origin, $allowed)) header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = '/' . trim(preg_replace('#^/(api/)?(index\.php/?)?#', '/', $path), '/');
if (str_starts_with($path, '/api/')) $path = substr($path, 4);

set_exception_handler(function (Throwable $e) {
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $x) {}
    if ($e instanceof ApiError) json_out(['error' => $e->getMessage()], $e->getCode() ?: 400);
    error_log((string)$e);
    json_out(['error' => env('APP_DEBUG') ? $e->getMessage() : 'Server error. Please try again.'], 500);
});

if ($path === '/' || $path === '/health') {
    try { val("SELECT 1"); json_out(['ok' => true, 'service' => 'vishwaship-api', 'time' => date('c')]); }
    catch (Throwable $e) { json_out(['ok' => false, 'db' => 'unavailable', 'error' => $e->getMessage()], 503); }
}

// run migrations only when schema version changes
const SCHEMA_V = '9';
try { $sv = val("SELECT v FROM settings WHERE k='schema'"); } catch (Throwable $e) { $sv = null; }
if ($sv !== SCHEMA_V) { migrate(); set_setting('schema', SCHEMA_V); }

$ROUTES = [];
function route(string $m, string $pattern, callable $fn) { global $ROUTES; $ROUTES[] = [$m, '#^' . $pattern . '$#', $fn]; }

require __DIR__ . '/routes_public.php';
require __DIR__ . '/routes_customer.php';
require __DIR__ . '/routes_admin.php';
require __DIR__ . '/routes_more.php';
require __DIR__ . '/routes_v7.php';

foreach ($ROUTES as [$m, $re, $fn]) {
    if ($m === $method && preg_match($re, $path, $mm)) {
        array_shift($mm);
        $res = $fn(...$mm);
        json_out($res ?? ['ok' => true]);
    }
}
fail('Not found: ' . $method . ' ' . $path, 404);
