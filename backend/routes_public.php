<?php
// Public + auth routes

function content(): array {
    $c = json_decode(setting('content', '{}'), true) ?: [];
    return array_merge(default_content(), $c);
}

route('GET', '/public/config', function () {
    $rates = all("SELECT service, zone, first_500, add_500 FROM rate_card ORDER BY service, zone");
    $m = (float) setting('global_markup', 20);
    foreach ($rates as &$r) { $r['final_first'] = apply_markup((float)$r['first_500'], $m); $r['final_add'] = apply_markup((float)$r['add_500'], $m); unset($r['first_500'], $r['add_500']); }
    return [
        'content' => content(), 'rates' => $rates, 'zones' => ZONE_LABEL, 'services' => service_meta(),
        'service_enabled' => ['surface' => setting('service_surface_enabled', '1') === '1', 'express' => setting('service_express_enabled', '1') === '1'],
        'pickup_slots' => json_decode(setting('pickup_slots', '[]'), true), 'gst_pct' => (float) setting('gst_pct', 18),
        'vol_divisor' => (float) setting('vol_divisor', 5000), 'min_recharge' => (float) setting('min_recharge', 500),
        'payment_gateway' => setting('payment_gateway', 'test'), 'razorpay_key_id' => setting('razorpay_key_id', ''),
        'require_kyc' => setting('require_kyc', '0') === '1',
        'company' => ['name' => setting('company_name'), 'gstin' => setting('company_gstin'), 'address' => setting('company_address'), 'gst_pct' => setting('gst_pct')],
    ];
});

route('POST', '/public/quote', function () {
    $from = preg_replace('/\D/', '', (string) req('from')); $to = preg_replace('/\D/', '', (string) req('to'));
    if (strlen($from) !== 6 || strlen($to) !== 6) fail('Enter valid 6-digit pincodes');
    $w = (float) req('weight'); if ($w <= 0) fail('Enter weight');
    $u = current_user();
    return quote($from, $to, $w, in('l', 0), in('b', 0), in('h', 0), in('payment', 'prepaid') === 'cod' ? 'cod' : 'prepaid', (float) in('cod_amount', 0), $u && $u['role'] === 'customer' ? $u : null);
});

function pincode_info(string $pin): array {
    $svc = delhivery_serviceability($pin);
    $city = $svc['city'] ?? null; $state = null;
    $cached = setting('pin_' . $pin);
    if ($cached) { [$city, $state] = explode('|', $cached); }
    else {
        $ctx = stream_context_create(['http' => ['timeout' => 4], 'ssl' => ['verify_peer' => true]]);
        $raw = @file_get_contents('https://api.postalpincode.in/pincode/' . $pin, false, $ctx);
        $j = $raw ? json_decode($raw, true) : null;
        $po = $j[0]['PostOffice'][0] ?? null;
        if ($po) { $city = $po['District']; $state = $po['State']; set_setting('pin_' . $pin, "$city|$state"); }
        elseif ($j && ($j[0]['Status'] ?? '') === 'Error') { $svc = ['serviceable' => false, 'prepaid' => false, 'cod' => false, 'pickup' => false, 'reverse' => false]; }
    }
    return array_merge($svc, ['pincode' => $pin, 'city' => $city, 'state' => $state]);
}
route('GET', '/public/pincode/(\d{6})', fn($pin) => pincode_info($pin));

route('GET', '/public/track/([A-Za-z0-9\-]+)', function ($awb) {
    $s = one("SELECT * FROM shipments WHERE awb=? OR order_no=?", [$awb, $awb]);
    if (!$s) fail('No shipment found for this AWB', 404);
    return [
        'awb' => $s['awb'], 'order_no' => $s['order_no'], 'status' => $s['status'], 'status_label' => STATUS_LABEL[$s['status']] ?? $s['status'],
        'from_city' => $s['from_city'], 'to_city' => $s['to_city'], 'to_name' => mb_substr($s['to_name'], 0, 1) . '***', 'eta' => $s['eta'], 'service' => $s['service'],
        'delivered_at' => $s['delivered_at'],
        'events' => all("SELECT status,label,location,remark,event_time FROM tracking_events WHERE shipment_id=? ORDER BY event_time DESC, id DESC", [$s['id']]),
    ];
});

route('POST', '/public/contact', function () {
    insert('enquiries', ['name' => req('name'), 'phone' => in('phone', ''), 'email' => in('email', ''), 'message' => req('message')]);
    return ['ok' => true];
});

// ---------- auth ----------
route('POST', '/auth/signup', function () {
    $email = strtolower(trim((string) req('email')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email');
    $mobile = preg_replace('/\D/', '', (string) req('mobile'));
    if (strlen($mobile) < 10) fail('Enter a valid 10-digit mobile number');
    $pw = (string) req('password'); if (strlen($pw) < 6) fail('Password must be at least 6 characters');
    if (!in('agree')) fail('Please accept the Terms & shipping policy');
    if (val("SELECT id FROM users WHERE email=?", [$email])) fail('An account with this email already exists. Please login.');
    $gst = strtoupper(trim((string) in('gstin', '')));
    $id = insert('users', ['role' => 'customer', 'name' => trim((string) req('name')), 'business_name' => trim((string) in('business_name', '')) ?: null,
        'mobile' => substr($mobile, -10), 'email' => $email, 'password_hash' => password_hash($pw, PASSWORD_DEFAULT),
        'gstin' => $gst ?: null, 'monthly_volume' => in('monthly_volume', null), 'last_login' => date('Y-m-d H:i:s')]);
    $u = one("SELECT * FROM users WHERE id=?", [$id]);
    return ['token' => make_token($u), 'user' => public_user($u)];
});

route('POST', '/auth/login', function () {
    $id = strtolower(trim((string) req('email')));
    $u = one("SELECT * FROM users WHERE email=? OR mobile=?", [$id, preg_replace('/\D/', '', $id) ?: '-']);
    if (!$u || !password_verify((string) req('password'), $u['password_hash'])) fail('Wrong email/mobile or password', 401);
    if ($u['status'] === 'blocked') fail('Your account is blocked. Please contact support.', 403);
    update('users', ['last_login' => date('Y-m-d H:i:s')], 'id=?', [$u['id']]);
    return ['token' => make_token($u), 'user' => public_user($u)];
});

route('GET', '/auth/me', function () {
    $u = require_user();
    return ['user' => public_user($u), 'impersonating' => (bool) $u['_imp']];
});

route('POST', '/auth/password', function () {
    $u = require_user();
    if (!password_verify((string) req('current'), $u['password_hash'])) fail('Current password is wrong');
    $n = (string) req('new'); if (strlen($n) < 6) fail('New password must be at least 6 characters');
    update('users', ['password_hash' => password_hash($n, PASSWORD_DEFAULT)], 'id=?', [$u['id']]);
    return ['ok' => true];
});

route('POST', '/auth/forgot', function () {
    $e = strtolower(trim((string) req('email')));
    if (val("SELECT id FROM users WHERE email=?", [$e])) insert('enquiries', ['name' => 'Password reset request', 'email' => $e, 'message' => 'User requested a password reset.']);
    return ['ok' => true, 'message' => 'If this email is registered, our team will contact you to reset your password.'];
});

// ---------- files ----------
route('POST', '/files', function () {
    $u = require_user();
    $data = (string) req('data');
    if (str_contains($data, ',')) $data = explode(',', $data, 2)[1];
    $bin = base64_decode($data, true);
    if ($bin === false) fail('Invalid file');
    if (strlen($bin) > 4 * 1024 * 1024) fail('File too large (max 4 MB)');
    $mime = (string) in('mime', 'application/octet-stream');
    if (!preg_match('#^(image/(png|jpe?g|webp|gif)|application/pdf)$#', $mime)) fail('Only images or PDF allowed');
    $id = insert('files', ['user_id' => $u['id'], 'name' => mb_substr((string) in('name', 'file'), 0, 150), 'mime' => $mime, 'data' => $bin]);
    return ['id' => $id];
});
route('GET', '/files/(\d+)', function ($id) {
    $u = require_user();
    $f = one("SELECT * FROM files WHERE id=?", [$id]);
    if (!$f) fail('Not found', 404);
    if ($u['role'] === 'customer' && (int)$f['user_id'] !== (int)$u['id']) {
        // customers may view proofs attached to their own disputes
        $ok = val("SELECT id FROM weight_disputes WHERE user_id=? AND FIND_IN_SET(?, proof_ids)", [$u['id'], $id]);
        if (!$ok) fail('Not allowed', 403);
    }
    header('Content-Type: ' . $f['mime']);
    header('Cache-Control: private, max-age=86400');
    echo $f['data'];
    exit;
});

// ---------- Delhivery status webhook ----------
route('POST', '/delhivery/webhook', function () {
    $b = body();
    $sh = $b['Shipment'] ?? $b;
    $awb = (string) ($sh['AWB'] ?? $sh['waybill'] ?? '');
    $st = $sh['Status'] ?? [];
    api_log('Webhook received', $awb, 'success', $b);
    $s = $awb ? one("SELECT * FROM shipments WHERE awb=?", [$awb]) : null;
    if ($s && is_array($st) && ($new = map_delhivery_status($st))) apply_status($s, $new, $st['Status'] ?? '', $st['StatusLocation'] ?? '', $st['Instructions'] ?? '');
    return ['ok' => true];
});
