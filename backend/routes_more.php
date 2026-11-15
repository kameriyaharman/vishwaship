<?php
// Extra customer features: billing views, tools, reports, settings hub, integrations, account actions.

function date_range_params(): array {
    $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-01', strtotime('-2 months'));
    $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : date('Y-m-d');
    return [$from, $to, "$from 00:00:00", "$to 23:59:59"];
}

// ---------- billing ----------
route('GET', '/me/ledger', function () {
    $u = require_customer();
    [$from, $to, $a, $b] = date_range_params();
    $w = 'user_id=? AND created_at BETWEEN ? AND ?'; $p = [$u['id'], $a, $b];
    $view = $_GET['view'] ?? 'passbook';
    if ($view === 'recharges') { $w .= " AND category='recharge'"; }
    elseif ($view === 'credit_notes') { $w .= " AND type='credit' AND category IN ('refund','adjustment','cod')"; }
    elseif ($view === 'debit_notes') { $w .= " AND type='debit' AND category IN ('weight','rto','adjustment')"; }
    $rows = all("SELECT * FROM wallet_txns WHERE $w ORDER BY id DESC LIMIT 2000", $p);
    $first = one("SELECT balance_after, amount, type FROM wallet_txns WHERE user_id=? AND created_at >= ? ORDER BY id ASC LIMIT 1", [$u['id'], $a]);
    $opening = $first ? (float)$first['balance_after'] + ($first['type'] === 'debit' ? (float)$first['amount'] : -(float)$first['amount']) : (float) $u['wallet_balance'];
    $last = one("SELECT balance_after FROM wallet_txns WHERE user_id=? AND created_at <= ? ORDER BY id DESC LIMIT 1", [$u['id'], $b]);
    $closing = $last ? (float)$last['balance_after'] : $opening;
    $cr = array_sum(array_map(fn($r) => $r['type'] === 'credit' ? (float)$r['amount'] : 0, $rows));
    $dr = array_sum(array_map(fn($r) => $r['type'] === 'debit' ? (float)$r['amount'] : 0, $rows));
    if (!empty($_GET['export'])) csv_out("$view-$from-to-$to.csv", ['Date', 'Ref', 'Description', 'Category', 'Credit', 'Debit', 'Balance'],
        array_map(fn($r) => [$r['created_at'], $r['ref'], $r['description'], $r['category'], $r['type'] === 'credit' ? $r['amount'] : '', $r['type'] === 'debit' ? $r['amount'] : '', $r['balance_after']], array_reverse($rows)));
    return ['items' => $rows, 'opening' => round($opening, 2), 'closing' => round($closing, 2), 'credits' => round($cr, 2), 'debits' => round($dr, 2), 'from' => $from, 'to' => $to];
});


// ---------- notification credits ----------
route('GET', '/me/notif-credits', function () {
    $u = require_customer();
    return ['balance' => (int)$u['notif_credits'], 'price' => (float) setting('notif_credit_price', 0.25), 'provider' => setting('notif_provider_enabled') === '1',
        'provider_name' => setting('notif_provider_name'), 'items' => all("SELECT * FROM notification_credits WHERE user_id=? ORDER BY id DESC LIMIT 300", [$u['id']])];
});
route('POST', '/me/notif-credits/buy', function () {
    $u = require_customer();
    $n = (int) req('credits'); if ($n < 100) fail('Minimum 100 credits');
    $amt = round($n * (float) setting('notif_credit_price', 0.25) * (1 + (float) setting('gst_pct', 18) / 100), 2);
    if ((float)$u['wallet_balance'] < $amt) fail('Insufficient wallet balance (₹' . $amt . ' needed incl. GST)');
    db()->beginTransaction();
    wallet_txn((int)$u['id'], 'debit', $amt, "Notification credits × $n", 'NC' . time(), 'notification');
    $bal = (int)$u['notif_credits'] + $n;
    update('users', ['notif_credits' => $bal], 'id=?', [$u['id']]);
    insert('notification_credits', ['user_id' => $u['id'], 'type' => 'credit', 'credits' => $n, 'balance_after' => $bal, 'description' => 'Purchased from wallet (₹' . $amt . ')']);
    db()->commit();
    activity((int)$u['id'], 'Bought notification credits', "$n credits");
    return ['balance' => $bal];
});

// ---------- tools ----------
route('GET', '/me/price-list', function () {
    $u = require_customer();
    $m = markup_for($u);
    $rows = all("SELECT service, zone, first_500, add_500 FROM rate_card ORDER BY service, zone");
    $dis = (array) (prefs($u)['disabled_services'] ?? []);
    $out = [];
    foreach ($rows as $r) {
        if (setting("service_{$r['service']}_enabled", '1') !== '1') continue;
        $f = apply_markup((float)$r['first_500'], $m); $a = apply_markup((float)$r['add_500'], $m);
        $out[] = ['service' => $r['service'], 'zone' => $r['zone'], 'zone_label' => ZONE_LABEL[$r['zone']], 'first_500' => $f, 'add_500' => $a,
            'kg1' => $f + $a, 'kg2' => $f + 3 * $a, 'kg5' => $f + 9 * $a, 'disabled' => in_array($r['service'], $dis)];
    }
    return ['items' => $out, 'rto_pct' => (float) setting('rto_pct', 100), 'shipmozo' => shipmozo_on() && !in_array('shipmozo', $dis), 'markup' => $m, 'cod_fixed' => apply_markup((float) setting('cod_fixed', 30), $m), 'cod_pct' => round((float) setting('cod_pct', 1.5) * (1 + $m / 100), 2),
        'gst_pct' => (float) setting('gst_pct', 18), 'vol_divisor' => (float) setting('vol_divisor', 5000), 'services' => service_meta()];
});
route('GET', '/me/activity', function () {
    $u = require_customer();
    return ['items' => all("SELECT a.*, s.name actor FROM activity_logs a LEFT JOIN users s ON s.id=a.actor_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 300", [$u['id']])];
});

// ---------- reports ----------
const REPORT_COLS = [
    'awb' => 'AWB', 'order_no' => 'Order', 'created_at' => 'Booked on', 'status' => 'Status', 'from_city' => 'From city', 'from_pincode' => 'From pin',
    'to_name' => 'Receiver', 'to_phone' => 'Receiver phone', 'to_address' => 'Address', 'to_city' => 'To city', 'to_state' => 'To state', 'to_pincode' => 'To pin',
    'product' => 'Product', 'invoice_value' => 'Invoice value', 'payment_mode' => 'Payment', 'cod_amount' => 'COD amount', 'service' => 'Service', 'zone' => 'Zone',
    'weight' => 'Weight', 'length' => 'L', 'breadth' => 'B', 'height' => 'H', 'vol_weight' => 'Vol. weight', 'chargeable_weight' => 'Chargeable', 'freight' => 'Freight',
    'cod_charge' => 'COD charge', 'gst' => 'GST', 'total' => 'Total', 'eta' => 'ETA', 'delivered_at' => 'Delivered at', 'ndr_attempts' => 'NDR attempts',
    'ndr_reason' => 'NDR reason', 'ndr_action' => 'NDR action', 'rto_charge' => 'RTO charge', 'cod_status' => 'COD status',
];
route('GET', '/me/reports/columns', fn() => ['columns' => REPORT_COLS]);
route('GET', '/me/reports/export', function () {
    $u = require_customer();
    [$from, $to, $a, $b] = date_range_params();
    $type = $_GET['type'] ?? 'shipment';
    $w = 'user_id=? AND created_at BETWEEN ? AND ?'; $p = [$u['id'], $a, $b];
    $sets = [
        'shipment' => ['awb', 'order_no', 'created_at', 'from_city', 'to_city', 'to_pincode', 'service', 'payment_mode', 'weight', 'chargeable_weight', 'total', 'status', 'eta', 'delivered_at'],
        'order' => ['order_no', 'created_at', 'to_name', 'to_phone', 'to_address', 'to_city', 'to_state', 'to_pincode', 'product', 'invoice_value', 'payment_mode', 'cod_amount', 'awb', 'status'],
        'ndr' => ['awb', 'order_no', 'to_name', 'to_phone', 'to_city', 'ndr_attempts', 'ndr_reason', 'ndr_action', 'status', 'rto_charge'],
    ];
    if ($type === 'custom') {
        $cols = array_values(array_intersect(explode(',', $_GET['columns'] ?? ''), array_keys(REPORT_COLS)));
        if (!$cols) fail('Choose at least one column');
        if (!empty($_GET['status'])) { $w .= ' AND status=?'; $p[] = $_GET['status']; }
        if (!empty($_GET['payment'])) { $w .= ' AND payment_mode=?'; $p[] = $_GET['payment']; }
    } else $cols = $sets[$type] ?? fail('Unknown report');
    if ($type === 'ndr') $w .= " AND (ndr_attempts>0 OR status IN ('ndr','rto_in_transit','rto_delivered'))";
    $w .= $type === 'order' ? '' : ' AND is_draft=0';
    $rows = all("SELECT `" . implode('`,`', $cols) . "` FROM shipments WHERE $w ORDER BY created_at DESC", $p);
    activity((int)$u['id'], 'Downloaded report', ucfirst($type) . " $from → $to");
    csv_out("$type-report-$from-to-$to.csv", array_map(fn($c) => REPORT_COLS[$c], $cols), $rows);
});

// ---------- settings hub (prefs) ----------
const PREF_KEYS = ['tracking', 'label', 'invoice', 'auto_assign', 'notifications', 'cod_confirmation', 'disabled_services'];
route('GET', '/me/prefs', function () {
    $u = require_customer();
    return ['prefs' => (object) prefs($u), 'early_cod' => (bool)$u['early_cod'], 'early_cod_fee_pct' => (float) setting('early_cod_fee_pct', 1),
        'early_cod_cycle' => setting('early_cod_cycle'), 'cod_cycle' => $u['cod_cycle'], 'provider' => setting('notif_provider_enabled') === '1',
        'cod_confirm_available' => setting('cod_confirm_enabled') === '1', 'notif_credits' => (int)$u['notif_credits']];
});
route('PUT', '/me/prefs', function () {
    $u = require_customer();
    $patch = [];
    foreach (PREF_KEYS as $k) if (array_key_exists($k, body())) $patch[$k] = body()[$k];
    if (isset($patch['disabled_services'])) {
        $patch['disabled_services'] = array_values(array_intersect((array)$patch['disabled_services'], ['surface', 'express', 'shipmozo']));
        if (count($patch['disabled_services']) >= 3) fail('Keep at least one courier service enabled');
        $cur = prefs($u); $cur['disabled_services'] = $patch['disabled_services'];
        update('users', ['prefs' => json_encode($cur, JSON_UNESCAPED_UNICODE)], 'id=?', [$u['id']]);
        unset($patch['disabled_services']);
    }
    $new = $patch ? save_prefs((int)$u['id'], $patch) : prefs(one("SELECT * FROM users WHERE id=?", [$u['id']]));
    activity((int)$u['id'], 'Updated settings', implode(', ', array_keys(body())));
    return ['prefs' => (object) $new];
});
route('POST', '/me/early-cod', function () {
    $u = require_customer();
    $on = (bool) in('enable');
    update('users', ['early_cod' => $on ? 1 : 0, 'cod_cycle' => $on ? 'Early COD' : 'Weekly'], 'id=?', [$u['id']]);
    activity((int)$u['id'], $on ? 'Subscribed to Early COD' : 'Cancelled Early COD');
    return ['ok' => true];
});

// ---------- integrations ----------
route('GET', '/me/api-key', function () { $u = require_customer(); return ['has_key' => !empty($u['api_key'])]; });
route('POST', '/me/api-key', function () {
    $u = require_customer();
    if (!empty($u['_api'])) fail('Use the web panel to rotate the API key');
    $key = 'vs_live_' . bin2hex(random_bytes(20));
    update('users', ['api_key' => hash('sha256', $key)], 'id=?', [$u['id']]);
    activity((int)$u['id'], 'Generated API key');
    return ['key' => $key];
});
route('DELETE', '/me/api-key', function () { $u = require_customer(); update('users', ['api_key' => null], 'id=?', [$u['id']]); activity((int)$u['id'], 'Revoked API key'); return ['ok' => true]; });
route('POST', '/me/integration-request', function () {
    $u = require_customer();
    $ch = (string) req('channel');
    insert('tickets', ['user_id' => $u['id'], 'subject' => "Integration request: $ch", 'message' => (string) in('message', "Please connect my $ch store.")]);
    activity((int)$u['id'], 'Requested integration', $ch);
    return ['ok' => true];
});

// Public EDD (estimated delivery date) — used by the embeddable widget
route('GET', '/public/edd', function () {
    $from = preg_replace('/\D/', '', (string) ($_GET['from'] ?? '')); $to = preg_replace('/\D/', '', (string) ($_GET['to'] ?? ''));
    if (strlen($to) !== 6) fail('Enter a valid 6-digit pincode');
    $svc = delhivery_serviceability($to);
    if (!$svc['serviceable']) return ['serviceable' => false, 'message' => 'Delivery not available to ' . $to];
    $meta = service_meta();
    $s = ($_GET['service'] ?? 'surface') === 'express' ? 'express' : 'surface';
    $zone = strlen($from) === 6 ? zone_for($from, $to) : 'D';
    $days = $meta[$s]['eta'] + ($zone === 'E' ? 2 : ($zone === 'A' ? -1 : 0));
    $days = max(1, $days);
    $d = strtotime("+$days days"); if (date('N', $d) == 7) $d = strtotime('+1 day', $d);
    return ['serviceable' => true, 'cod' => $svc['cod'], 'days' => $days, 'date' => date('Y-m-d', $d), 'label' => 'Delivery by ' . date('D, j M', $d)];
});

// ---------- account ----------
route('POST', '/auth/logout-all', function () {
    $u = require_user();
    q("UPDATE users SET token_version=token_version+1 WHERE id=?", [$u['id']]);
    activity((int)$u['id'], 'Logged out from all other devices');
    $fresh = one("SELECT * FROM users WHERE id=?", [$u['id']]);
    return ['token' => make_token($fresh)];
});
route('POST', '/me/delete-request', function () {
    $u = require_customer();
    if (!password_verify((string) req('password'), $u['password_hash'])) fail('Password is incorrect');
    update('users', ['deletion_requested_at' => date('Y-m-d H:i:s'), 'deletion_reason' => mb_substr((string) in('reason', ''), 0, 250)], 'id=?', [$u['id']]);
    activity((int)$u['id'], 'Requested account deletion');
    return ['ok' => true, 'message' => 'Request received. Our team will settle your wallet / COD dues and delete the account within 7 working days.'];
});
route('POST', '/me/delete-request/cancel', function () { $u = require_customer(); update('users', ['deletion_requested_at' => null, 'deletion_reason' => null], 'id=?', [$u['id']]); return ['ok' => true]; });

// Public brand logo (for branded tracking page)
route('GET', '/public/brand-logo/(\d+)', function ($uid) {
    $u = one("SELECT prefs FROM users WHERE id=?", [$uid]);
    $fid = (json_decode($u['prefs'] ?? '', true) ?: [])['tracking']['logo_id'] ?? null;
    $f = $fid ? one("SELECT mime, data FROM files WHERE id=? AND user_id=?", [$fid, $uid]) : null;
    if (!$f) fail('Not found', 404);
    header('Content-Type: ' . $f['mime']); header('Cache-Control: public, max-age=3600'); echo $f['data']; exit;
});

// ---------- Customer care complaints (public) ----------
route('POST', '/public/complaints', function () {
    $name = trim((string) req('name')); $mobile = preg_replace('/\D/', '', (string) req('mobile')); $email = strtolower(trim((string) req('email')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email');
    if (strlen($mobile) < 10) fail('Enter a valid mobile number');
    $fileId = null;
    if ($data = (string) in('file_data', '')) {
        if (str_contains($data, ',')) $data = explode(',', $data, 2)[1];
        $bin = base64_decode($data, true);
        $mime = (string) in('file_mime', '');
        if ($bin === false || strlen($bin) > 5 * 1024 * 1024) fail('Attachment must be under 5 MB');
        if (!preg_match('#^(image/(png|jpe?g|webp)|application/pdf)$#', $mime)) fail('Attach an image or PDF');
        $fileId = insert('files', ['user_id' => null, 'name' => mb_substr((string) in('file_name', 'attachment'), 0, 150), 'mime' => $mime, 'data' => $bin]);
    }
    $u = current_user();
    do { $no = 'VSC-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6)); } while (val("SELECT id FROM complaints WHERE ticket_no=?", [$no]));
    insert('complaints', ['ticket_no' => $no, 'user_id' => $u && $u['role'] === 'customer' ? $u['id'] : (val("SELECT id FROM users WHERE email=? AND role='customer'", [$email]) ?: null),
        'name' => mb_substr($name, 0, 120), 'mobile' => substr($mobile, -10), 'email' => $email, 'category' => mb_substr((string) req('category'), 0, 60),
        'awb' => mb_substr(trim((string) in('awb', '')), 0, 40) ?: null, 'courier' => mb_substr(trim((string) in('courier', '')), 0, 80) ?: null,
        'subject' => mb_substr((string) req('subject'), 0, 200), 'message' => (string) req('message'), 'file_id' => $fileId]);
    return ['ticket_no' => $no];
});
route('POST', '/public/complaints/lookup', function () {
    $c = one("SELECT ticket_no, category, awb, subject, message, status, reply, created_at, updated_at FROM complaints WHERE ticket_no=? AND email=?", [strtoupper(trim((string) req('ticket_no'))), strtolower(trim((string) req('email')))]);
    if (!$c) fail('No complaint found for this ticket ID and email', 404);
    return $c;
});
route('GET', '/admin/complaints', function () {
    require_admin('support');
    $w = '1=1'; $p = [];
    if (!empty($_GET['status'])) { $w = 'status=?'; $p[] = $_GET['status']; }
    return ['items' => all("SELECT * FROM complaints WHERE $w ORDER BY FIELD(status,'open','in_progress','resolved','closed'), id DESC LIMIT 500", $p),
        'counts' => array_column(all("SELECT status, COUNT(*) n FROM complaints GROUP BY status"), 'n', 'status')];
});
route('POST', '/admin/complaints/(\d+)', function ($id) {
    require_admin('support');
    $d = [];
    if (in('reply') !== null) $d['reply'] = in('reply');
    if (in('status')) $d['status'] = in('status');
    update('complaints', $d, 'id=?', [$id]);
    return ['ok' => true];
});

// ---------- store connectors ----------
function channel_out(array $c): array {
    $k = ch_creds($c);
    $c['credentials'] = array_map(fn($v) => $v ? '••••' . substr((string) $v, -4) : '', $k);
    $c['settings'] = ch_settings($c);
    return $c;
}
route('GET', '/me/channels', function () {
    $u = require_customer();
    return ['items' => array_map('channel_out', all("SELECT * FROM channels WHERE user_id=? ORDER BY id DESC", [$u['id']])), 'api_key' => !empty($u['api_key'])];
});
route('POST', '/me/channels', function () {
    $u = require_customer();
    $type = (string) req('type');
    if (!in_array($type, ['shopify', 'woocommerce', 'custom'], true)) fail('Unknown channel');
    $url = trim((string) in('store_url', ''));
    $cred = []; $set = ['auto_import' => 1, 'push_tracking' => 1, 'complete_order' => in('complete_order') ? 1 : 0];
    if ($type === 'shopify') { $url = shopify_domain($url); if (!preg_match('/^[a-z0-9-]+\.myshopify\.com$/', $url)) fail('Enter your store as yourstore.myshopify.com'); $cred['token'] = trim((string) req('token')); }
    if ($type === 'woocommerce') { if (!preg_match('#^https://#i', $url)) fail('Enter the store URL starting with https://'); $cred = ['key' => trim((string) req('consumer_key')), 'secret' => trim((string) req('consumer_secret'))]; }
    if ($type === 'custom') {
        $hook = trim((string) in('webhook_url', ''));
        if ($hook !== '' && !preg_match('#^https://#i', $hook)) fail('Webhook URL must start with https://');
        $set['webhook_url'] = $hook; $cred['webhook_secret'] = bin2hex(random_bytes(16));
        if (!$u['api_key']) fail('Generate your API key first (API Integration tab)');
    }
    $c = ['id' => 0, 'user_id' => $u['id'], 'type' => $type, 'store_url' => $url, 'credentials' => json_encode($cred), 'settings' => json_encode($set), 'imported' => 0];
    $name = $url ?: 'Custom website';
    if ($type !== 'custom') { $t = $type === 'shopify' ? shopify_test($c) : woo_test($c); if (!$t['ok']) fail('Could not connect: ' . $t['error']); $name = $t['name']; }
    if (val("SELECT id FROM channels WHERE user_id=? AND type=? AND store_url=?", [$u['id'], $type, $url])) fail('This store is already connected');
    $id = insert('channels', ['user_id' => $u['id'], 'type' => $type, 'name' => mb_substr($name, 0, 120), 'store_url' => $url, 'credentials' => json_encode($cred), 'settings' => json_encode($set), 'status' => 'connected']);
    activity((int) $u['id'], 'Connected ' . ucfirst($type), $name);
    $c = one("SELECT * FROM channels WHERE id=?", [$id]);
    $n = 0; if ($type !== 'custom') { try { $n = channel_sync($c); } catch (Throwable $e) { update('channels', ['last_error' => mb_substr($e->getMessage(), 0, 250)], 'id=?', [$id]); } }
    return channel_out(one("SELECT * FROM channels WHERE id=?", [$id])) + ['imported_now' => $n, 'webhook_secret' => $cred['webhook_secret'] ?? null];
});
route('POST', '/me/channels/(\d+)/sync', function ($id) {
    $u = require_customer();
    $c = one("SELECT * FROM channels WHERE id=? AND user_id=?", [$id, $u['id']]); if (!$c) fail('Not found', 404);
    if ($c['type'] === 'custom') fail('Custom websites push orders through the API');
    try { $n = channel_sync($c); } catch (Throwable $e) { update('channels', ['last_error' => mb_substr($e->getMessage(), 0, 250), 'status' => 'error'], 'id=?', [$id]); fail($e->getMessage()); }
    return ['imported' => $n];
});
route('PUT', '/me/channels/(\d+)', function ($id) {
    $u = require_customer();
    $c = one("SELECT * FROM channels WHERE id=? AND user_id=?", [$id, $u['id']]); if (!$c) fail('Not found', 404);
    $set = ch_settings($c);
    foreach (['auto_import', 'push_tracking', 'complete_order'] as $k) if (in($k) !== null) $set[$k] = in($k) ? 1 : 0;
    if (in('webhook_url') !== null) { $h = trim((string) in('webhook_url')); if ($h !== '' && !preg_match('#^https://#i', $h)) fail('Webhook URL must start with https://'); $set['webhook_url'] = $h; }
    update('channels', ['settings' => json_encode($set)], 'id=?', [$id]);
    return channel_out(one("SELECT * FROM channels WHERE id=?", [$id]));
});
route('DELETE', '/me/channels/(\d+)', function ($id) {
    $u = require_customer();
    q("DELETE FROM channels WHERE id=? AND user_id=?", [$id, $u['id']]);
    return ['ok' => true];
});
// custom website / any system: push an order (lands in Drafts). Auth: X-Api-Key
route('POST', '/me/orders', function () {
    $u = require_customer();
    $ext = mb_substr(trim((string) in('order_id', '')), 0, 64);
    $c = one("SELECT * FROM channels WHERE user_id=? AND type='custom' ORDER BY id LIMIT 1", [$u['id']]);
    if ($ext && $c && ($dup = val("SELECT id FROM shipments WHERE channel_id=? AND channel_order_id=?", [$c['id'], $ext]))) return ['draft_id' => (int) $dup, 'duplicate' => true];
    foreach (['to_name' => 'Receiver name', 'to_phone' => 'Receiver mobile', 'to_pincode' => 'Delivery pincode', 'to_address' => 'Address'] as $k => $l) if (trim((string) in($k, '')) === '') fail("$l is required");
    $pickup = in('pickup_id') ? one("SELECT * FROM pickup_addresses WHERE id=? AND user_id=?", [(int) in('pickup_id'), $u['id']]) : one("SELECT * FROM pickup_addresses WHERE user_id=? ORDER BY is_default DESC, id LIMIT 1", [$u['id']]);
    if (!$pickup) fail('Add a pickup address in Vishwaship first');
    $pay = in('payment_mode') === 'cod' ? 'cod' : 'prepaid';
    $id = insert('shipments', ['user_id' => $u['id'], 'pickup_id' => $pickup['id'], 'order_no' => next_order_no(), 'is_draft' => 1, 'status' => 'draft',
        'channel_id' => $c['id'] ?? null, 'channel_order_id' => $ext ?: null, 'order_ref' => mb_substr((string) in('order_ref', $ext), 0, 60) ?: null,
        'from_name' => $pickup['name'], 'from_contact' => $pickup['contact'], 'from_phone' => $pickup['phone'], 'from_address' => $pickup['address'], 'from_city' => $pickup['city'], 'from_state' => $pickup['state'], 'from_pincode' => $pickup['pincode'],
        'to_name' => mb_substr(trim((string) in('to_name')), 0, 120), 'to_phone' => substr(preg_replace('/\D/', '', (string) in('to_phone')), -10), 'to_address' => mb_substr(trim((string) in('to_address')), 0, 250),
        'to_city' => in('to_city'), 'to_state' => in('to_state'), 'to_pincode' => substr(preg_replace('/\D/', '', (string) in('to_pincode')), 0, 6),
        'product' => mb_substr((string) in('product', ''), 0, 190), 'invoice_value' => (float) in('invoice_value', 0), 'payment_mode' => $pay, 'cod_amount' => $pay === 'cod' ? (float) (in('cod_amount') ?: in('invoice_value', 0)) : 0,
        'weight' => max(0.05, (float) in('weight', 0.5)), 'length' => (float) in('length', 0), 'breadth' => (float) in('breadth', 0), 'height' => (float) in('height', 0), 'service' => 'surface']);
    return ['draft_id' => $id, 'order_no' => val("SELECT order_no FROM shipments WHERE id=?", [$id])];
});
