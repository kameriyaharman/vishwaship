<?php
// Vishwaship API — shared helpers (DB, JSON, auth, settings, pricing)

// Settings come from environment variables (Railway/Docker) or, on shared hosting
// like Hostinger, from config.php placed next to index.php (returns an array).
function env($k, $d = null) {
    static $cfg = null;
    if ($cfg === null) { $f = __DIR__ . '/config.php'; $cfg = is_file($f) ? (array) (include $f) : []; }
    $v = getenv($k);
    if ($v === false || $v === '') $v = $cfg[$k] ?? '';
    return ($v === false || $v === '' || $v === null) ? $d : $v;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $url = env('MYSQL_URL') ?: env('DATABASE_URL');
    if ($url && str_starts_with($url, 'mysql')) {
        $p = parse_url($url);
        $host = $p['host']; $port = $p['port'] ?? 3306; $user = urldecode($p['user'] ?? 'root');
        $pass = urldecode($p['pass'] ?? ''); $name = ltrim($p['path'] ?? '/vishwaship', '/');
    } else {
        $host = env('DB_HOST', env('MYSQLHOST', '127.0.0.1'));
        $port = env('DB_PORT', env('MYSQLPORT', '3306'));
        $user = env('DB_USER', env('MYSQLUSER', 'root'));
        $pass = env('DB_PASS', env('MYSQLPASSWORD', ''));
        $name = env('DB_NAME', env('MYSQLDATABASE', 'vishwaship'));
    }
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+05:30'");
    return $pdo;
}

function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }
function one(string $sql, array $p = []) { return q($sql, $p)->fetch() ?: null; }
function all(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }
function val(string $sql, array $p = []) { $r = q($sql, $p)->fetchColumn(); return $r === false ? null : $r; }

function insert(string $table, array $data): int {
    $cols = array_keys($data);
    $sql = "INSERT INTO `$table` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")";
    q($sql, array_values($data));
    return (int) db()->lastInsertId();
}
function update(string $table, array $data, string $where, array $wp = []): void {
    if (!$data) return;
    $set = implode(',', array_map(fn($c) => "`$c`=?", array_keys($data)));
    q("UPDATE `$table` SET $set WHERE $where", array_merge(array_values($data), $wp));
}

function json_out($data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
class ApiError extends Exception {}
function fail(string $msg, int $code = 400): never { throw new ApiError($msg, $code); }

function body(): array {
    static $b = null;
    if ($b !== null) return $b;
    $raw = file_get_contents('php://input');
    $b = json_decode($raw ?: '[]', true);
    if (!is_array($b)) $b = $_POST ?: [];
    return $b;
}
function in(string $k, $d = null) { $b = body(); return array_key_exists($k, $b) ? $b[$k] : ($_GET[$k] ?? $d); }
function req(string $k) { $v = in($k); if ($v === null || $v === '') fail("Field '$k' is required"); return $v; }

// ---------- auth tokens (HMAC signed) ----------
function app_secret(): string { return env('APP_SECRET', 'vishwaship-change-this-secret'); }
function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64ud($s) { return base64_decode(strtr($s, '-_', '+/')); }
function make_token(array $user, ?int $impersonator = null): string {
    $p = ['uid' => (int)$user['id'], 'role' => $user['role'], 'tv' => (int)($user['token_version'] ?? 0), 'exp' => time() + 86400 * 14];
    if ($impersonator) $p['imp'] = $impersonator;
    $pl = b64u(json_encode($p));
    return $pl . '.' . b64u(hash_hmac('sha256', $pl, app_secret(), true));
}
function read_token(): ?array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('getallheaders')) { foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $h = $v; }
    $t = preg_match('/Bearer\s+(.+)/i', $h, $m) ? trim($m[1]) : ($_GET['token'] ?? '');
    if (!$t || !str_contains($t, '.')) return null;
    [$pl, $sig] = explode('.', $t, 2);
    if (!hash_equals(b64u(hash_hmac('sha256', $pl, app_secret(), true)), $sig)) return null;
    $p = json_decode(b64ud($pl), true);
    if (!$p || ($p['exp'] ?? 0) < time()) return null;
    return $p;
}
function current_user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if ($key) {
        $u = one("SELECT * FROM users WHERE api_key=? AND role='customer'", [hash('sha256', $key)]);
        if ($u) { $u['_imp'] = null; $u['_api'] = true; }
        return $u;
    }
    $t = read_token();
    $u = $t ? one("SELECT * FROM users WHERE id=?", [$t['uid']]) : null;
    if ($u && (int)($t['tv'] ?? 0) !== (int)$u['token_version']) $u = null;
    if ($u) $u['_imp'] = $t['imp'] ?? null;
    return $u;
}
function prefs(array $u): array { return json_decode($u['prefs'] ?? '', true) ?: []; }
function save_prefs(int $uid, array $patch): array {
    $cur = json_decode((string) val("SELECT prefs FROM users WHERE id=?", [$uid]), true) ?: [];
    $new = array_replace_recursive($cur, $patch);
    update('users', ['prefs' => json_encode($new, JSON_UNESCAPED_UNICODE)], 'id=?', [$uid]);
    return $new;
}
function activity(int $uid, string $action, string $detail = ''): void {
    try {
        $me = current_user();
        insert('activity_logs', ['user_id' => $uid, 'actor_id' => $me && (int)$me['id'] !== $uid ? $me['id'] : ($me['_imp'] ?? null), 'action' => $action,
            'detail' => mb_substr($detail, 0, 250), 'ip' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null]);
    } catch (Throwable $e) {}
}
function require_user(): array {
    $u = current_user();
    if (!$u) fail('Please login again', 401);
    if ($u['status'] === 'blocked') fail('Your account is blocked. Contact support.', 403);
    return $u;
}
function require_customer(): array { $u = require_user(); if ($u['role'] !== 'customer') fail('Customer account required', 403); return $u; }
function require_admin(?string $perm = null): array {
    $u = require_user();
    if (!in_array($u['role'], ['admin', 'staff'])) fail('Admin access required', 403);
    if ($perm && $u['role'] === 'staff') {
        $perms = json_decode($u['permissions'] ?: '[]', true) ?: [];
        if (!in_array($perm, $perms)) fail("You don't have permission for '$perm'", 403);
    }
    return $u;
}
function public_user(array $u): array {
    unset($u['password_hash'], $u['api_key']);
    $u['prefs'] = json_decode($u['prefs'] ?? '', true) ?: new stdClass();
    $u['permissions'] = json_decode($u['permissions'] ?? '[]', true) ?: [];
    return $u;
}

// ---------- settings ----------
function settings(): array {
    static $s = null;
    if ($s === null) { $s = []; foreach (all("SELECT k,v FROM settings") as $r) $s[$r['k']] = $r['v']; }
    return $s;
}
function setting(string $k, $d = null) { $s = settings(); return $s[$k] ?? $d; }
function set_setting(string $k, $v): void {
    q("INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [$k, is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : (string)$v]);
}

// ---------- pricing ----------
const METRO_PREFIX = ['110', '400', '700', '600', '560', '500', '411', '380', '122', '201'];
const SPECIAL_PREFIX = ['78', '79', '18', '19', '744', '737', '791', '792', '793', '794', '795', '796', '797', '798', '799'];
const ZONE_LABEL = ['A' => 'Local', 'B' => 'Regional', 'C' => 'Metro', 'D' => 'Rest of India', 'E' => 'NE / J&K'];

function zone_for(string $from, string $to): string {
    if (substr($from, 0, 3) === substr($to, 0, 3)) return 'A';
    foreach (SPECIAL_PREFIX as $p) if (str_starts_with($to, $p) || str_starts_with($from, $p)) return 'E';
    if (substr($from, 0, 2) === substr($to, 0, 2)) return 'B';
    if (in_array(substr($from, 0, 3), METRO_PREFIX) && in_array(substr($to, 0, 3), METRO_PREFIX)) return 'C';
    return 'D';
}
function slab_weight(float $w): float { return max(0.5, ceil(round($w, 3) / 0.5) * 0.5); }
function vol_weight($l, $b, $h): float { $div = (float) setting('vol_divisor', 5000); return round(((float)$l * (float)$b * (float)$h) / $div, 2); }

function rate_row(string $service, string $zone): ?array { return one("SELECT * FROM rate_card WHERE service=? AND zone=?", [$service, $zone]); }
function base_rate_card(string $service, string $zone, float $chargeable): float {
    $r = rate_row($service, $zone);
    if (!$r) return 0;
    $w = slab_weight($chargeable);
    $extra = max(0, ($w - 0.5) / 0.5);
    return round($r['first_500'] + $extra * $r['add_500'], 2);
}
function markup_for(?array $user): float {
    if ($user && $user['markup_pct'] !== null && $user['markup_pct'] !== '') return (float)$user['markup_pct'];
    return (float) setting('global_markup', 20);
}
function round_price(float $v): float {
    $mode = setting('rounding', 'ceil1');
    if ($mode === 'none') return round($v, 2);
    if ($mode === 'nearest1') return round($v);
    return ceil(round($v, 2));
}
function apply_markup(float $base, float $markup): float { return round_price($base * (1 + $markup / 100)); }

function service_meta(): array {
    return [
        'surface' => ['name' => 'Delhivery Surface', 'days' => setting('surface_days', '3–5 days'), 'eta' => (int) setting('surface_eta', 4)],
        'express' => ['name' => 'Delhivery Express (Air)', 'days' => setting('express_days', '1–2 days'), 'eta' => (int) setting('express_eta', 2)],
    ];
}

/** Full quote: returns options for surface & express with base + final */
function quote(string $from, string $to, float $weight, $l, $b, $h, string $payment, float $codAmount, ?array $user, float $value = 0): array {
    $vol = vol_weight($l, $b, $h);
    $charge = max($weight, $vol);
    $zone = zone_for($from, $to);
    $markup = markup_for($user);
    $gstPct = (float) setting('gst_pct', 18);
    $out = [];
    $dis = $user ? (array) (prefs($user)['disabled_services'] ?? []) : [];
    foreach (service_meta() as $svc => $meta) {
        if (setting('delhivery_enabled', '1') !== '1') break;
        if (setting("service_{$svc}_enabled", '1') !== '1') continue;
        if ($user && in_array($svc, (array) (prefs($user)['disabled_services'] ?? []))) continue;
        $base = null;
        if (delhivery_live()) $base = delhivery_cost($svc, $from, $to, $charge, $payment, $codAmount);
        if ($base === null) $base = base_rate_card($svc, $zone, $charge);
        $freight = apply_markup($base, $markup);
        $codBase = 0; $cod = 0;
        if ($payment === 'cod') {
            $codBase = max((float) setting('cod_fixed', 30), $codAmount * (float) setting('cod_pct', 1.5) / 100);
            $cod = apply_markup($codBase, $markup);
        }
        $gst = round(($freight + $cod) * $gstPct / 100, 2);
        $out[] = [
            'service' => $svc, 'provider' => 'delhivery', 'courier_id' => null, 'name' => $meta['name'], 'days' => $meta['days'],
            'eta' => date('Y-m-d', strtotime('+' . $meta['eta'] . ' days')),
            'base' => $base, 'cod_base' => $codBase, 'freight' => $freight, 'cod_charge' => $cod,
            'gst' => $gst, 'total' => round($freight + $cod + $gst, 2),
        ];
    }
    if (!in_array('shipmozo', $dis)) foreach (shipmozo_rates($from, $to, max($weight, $vol), $l, $b, $h, $payment, $codAmount, $value ?: $codAmount) as $r) {
        $freight = apply_markup($r['base'], $markup);
        $gst = round($freight * $gstPct / 100, 2);
        $out[] = ['service' => 'sm_' . $r['courier_id'], 'provider' => 'shipmozo', 'courier_id' => $r['courier_id'], 'name' => $r['name'], 'days' => $r['days'] ?: 'As per courier',
            'eta' => $r['eta'] ?: date('Y-m-d', strtotime('+4 days')), 'base' => $r['base'], 'cod_base' => 0, 'freight' => $freight, 'cod_charge' => 0, 'gst' => $gst, 'total' => round($freight + $gst, 2)];
    }
    return ['zone' => $zone, 'zone_label' => ZONE_LABEL[$zone], 'vol_weight' => $vol, 'actual_weight' => $weight,
        'chargeable_weight' => slab_weight($charge), 'raw_chargeable' => $charge, 'markup' => $markup, 'gst_pct' => $gstPct, 'options' => $out];
}

// ---------- wallet ----------
function wallet_txn(int $userId, string $type, float $amount, string $desc, ?string $ref = null, ?string $category = null): float {
    $amount = round(abs($amount), 2);
    $cur = (float) val("SELECT wallet_balance FROM users WHERE id=? FOR UPDATE", [$userId]);
    $new = $type === 'credit' ? $cur + $amount : $cur - $amount;
    update('users', ['wallet_balance' => $new], 'id=?', [$userId]);
    insert('wallet_txns', ['user_id' => $userId, 'type' => $type, 'amount' => $amount, 'balance_after' => $new,
        'description' => $desc, 'ref' => $ref, 'category' => $category ?? ($type === 'credit' ? 'recharge' : 'shipment')]);
    return $new;
}

function next_order_no(): string {
    $n = (int) val("SELECT COUNT(*) FROM shipments") + 10482;
    do { $no = 'VS-' . $n++; } while (val("SELECT id FROM shipments WHERE order_no=?", [$no]));
    return $no;
}

function add_event(int $shipmentId, string $status, string $label, string $location = '', string $remark = '', ?string $time = null): void {
    insert('tracking_events', ['shipment_id' => $shipmentId, 'status' => $status, 'label' => $label, 'location' => $location,
        'remark' => $remark, 'event_time' => $time ?? date('Y-m-d H:i:s')]);
}

const STATUS_LABEL = [
    'pickup_pending' => 'Pickup pending', 'picked_up' => 'Picked up', 'in_transit' => 'In transit',
    'out_for_delivery' => 'Out for delivery', 'delivered' => 'Delivered', 'ndr' => 'NDR',
    'rto_in_transit' => 'RTO', 'rto_delivered' => 'RTO delivered', 'cancelled' => 'Cancelled', 'lost' => 'Lost',
];

function api_log(string $api, string $request, string $result, $response = null): void {
    try { insert('api_logs', ['api' => $api, 'request' => mb_substr($request, 0, 250), 'result' => $result,
        'response' => $response === null ? null : mb_substr(is_string($response) ? $response : json_encode($response), 0, 4000)]); } catch (Throwable $e) {}
}

function csv_out(string $filename, array $headers, array $rows): never {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $f = fopen('php://output', 'w');
    fwrite($f, "\xEF\xBB\xBF");
    fputcsv($f, $headers);
    foreach ($rows as $r) fputcsv($f, array_values($r));
    exit;
}

function paginate(): array { $p = max(1, (int) ($_GET['page'] ?? 1)); $l = min(500, max(1, (int) ($_GET['limit'] ?? 50))); return [$l, ($p - 1) * $l]; }

/** Auto-accept weight disputes past deadline */
function sweep_disputes(): void {
    if (setting('auto_accept', '1') !== '1') return;
    $rows = all("SELECT * FROM weight_disputes WHERE status='open' AND deadline < NOW()");
    foreach ($rows as $d) accept_dispute($d, 'Auto-accepted after deadline');
}
function accept_dispute(array $d, string $note = 'Accepted by customer'): void {
    $gst = (float) setting('gst_pct', 18);
    $amt = round($d['customer_extra'] * (1 + $gst / 100), 2);
    db()->beginTransaction();
    if ($amt > 0) wallet_txn((int)$d['user_id'], 'debit', $amt, 'Weight discrepancy ' . $d['awb'], $d['awb'], 'weight');
    update('weight_disputes', ['status' => 'accepted', 'customer_action' => $note, 'charged_amount' => $amt, 'resolved_at' => date('Y-m-d H:i:s')], 'id=?', [$d['id']]);
    update('shipments', ['wd_open' => 0, 'courier_weight' => $d['courier_weight']], 'id=?', [$d['shipment_id']]);
    db()->commit();
}

require_once __DIR__ . '/delhivery.php';
require_once __DIR__ . '/shipmozo.php';
