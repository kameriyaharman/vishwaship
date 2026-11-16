<?php
// Admin portal routes (/admin/*). Staff users are limited by their permission list.

const ADMIN_SECTIONS = ['dashboard', 'customers', 'shipments', 'disputes', 'ndr', 'rates', 'wallet', 'reports', 'delhivery', 'staff', 'content', 'support'];

function period_bounds(?string $month): array {
    $m = preg_match('/^\d{4}-\d{2}$/', (string)$month) ? $month : date('Y-m');
    return [$m . '-01 00:00:00', date('Y-m-t 23:59:59', strtotime($m . '-01')), $m];
}
function money_stats(string $from, string $to, string $extra = '', array $p = []): array {
    $r = one("SELECT COUNT(*) n, COALESCE(SUM(freight+cod_charge),0) billed, COALESCE(SUM(base_rate+cod_base),0) cost FROM shipments WHERE is_draft=0 AND status<>'cancelled' AND created_at BETWEEN ? AND ? $extra", array_merge([$from, $to], $p));
    $wd = one("SELECT COALESCE(SUM(customer_extra),0) c, COALESCE(SUM(base_extra),0) b FROM weight_disputes WHERE status='accepted' AND resolved_at BETWEEN ? AND ?", [$from, $to]);
    $billed = (float)$r['billed'] + (float)$wd['c']; $cost = (float)$r['cost'] + (float)$wd['b'];
    return ['shipments' => (int)$r['n'], 'billed' => round($billed, 2), 'cost' => round($cost, 2), 'margin' => round($billed - $cost, 2), 'margin_pct' => $billed ? round(($billed - $cost) / $billed * 100, 1) : 0];
}

route('GET', '/admin/dashboard', function () {
    require_admin('dashboard');
    sweep_disputes();
    [$a, $b, $m] = period_bounds($_GET['month'] ?? null);
    $prev = period_bounds(date('Y-m', strtotime($m . '-01 -1 month')));
    $cur = money_stats($a, $b); $pv = money_stats($prev[0], $prev[1]);
    $status = status_counts('is_draft=0', []);
    $top = all("SELECT u.id, u.business_name, u.name, COUNT(s.id) n, SUM(s.freight+s.cod_charge) billed, SUM(s.freight+s.cod_charge-s.base_rate-s.cod_base) margin
        FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.is_draft=0 AND s.status<>'cancelled' AND s.created_at BETWEEN ? AND ? GROUP BY u.id ORDER BY n DESC LIMIT 5", [$a, $b]);
    $calls = one("SELECT COUNT(*) n, SUM(result='failed') f FROM api_logs WHERE created_at >= CURDATE()");
    $lastSync = val("SELECT created_at FROM api_logs WHERE api LIKE 'Tracking sync%' ORDER BY id DESC LIMIT 1");
    return [
        'month' => $m, 'customers' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer'"),
        'new_customers' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND created_at BETWEEN ? AND ?", [$a, $b]),
        'money' => $cur, 'growth' => $pv['shipments'] ? round(($cur['shipments'] - $pv['shipments']) / $pv['shipments'] * 100, 1) : null,
        'disputes_open' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status IN ('open','disputed')"),
        'disputes_amount' => (float) val("SELECT COALESCE(SUM(customer_extra),0) FROM weight_disputes WHERE status IN ('open','disputed')"),
        'disputes_to_delhivery' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status='disputed' AND delhivery_dispute IS NOT NULL"),
        'status' => $status, 'top' => $top,
        'api' => ['mode' => setting('delhivery_mode'), 'connected' => delhivery_live(), 'env' => setting('delhivery_env'), 'last_sync' => $lastSync,
            'calls_today' => (int)$calls['n'], 'errors_today' => (int)$calls['f'], 'pickups_today' => (int) val("SELECT COUNT(*) FROM shipments WHERE pickup_date=CURDATE() AND status='pickup_pending'")],
        'pricing' => ['global' => (float) setting('global_markup'), 'custom' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND markup_pct IS NOT NULL")],
        'alerts' => [
            'low_wallet' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND status='active' AND wallet_balance < ?", [(float) setting('low_wallet_threshold', 500)]),
            'low_wallet_threshold' => (float) setting('low_wallet_threshold', 500),
            'kyc_pending' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND kyc_status IN ('pending','submitted')"),
            'kyc_submitted' => (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND kyc_status='submitted'"),
            'tickets' => (int) val("SELECT COUNT(*) FROM tickets WHERE status='open'"),
            'enquiries' => (int) val("SELECT COUNT(*) FROM enquiries WHERE created_at >= ?", [date('Y-m-d', strtotime('-7 days'))]),
        ],
    ];
});

route('GET', '/admin/notifications', function () {
    require_admin();
    $n = [];
    if ($k = (int) val("SELECT COUNT(*) FROM users WHERE role='customer' AND kyc_status='submitted'")) $n[] = ['text' => "$k KYC pending approval", 'href' => '/admin/customers?kyc=submitted'];
    if ($k = (int) val("SELECT COUNT(*) FROM tickets WHERE last_reply_by='customer' AND status IN ('open','in_progress')")) $n[] = ['text' => "$k ticket(s) waiting for reply", 'href' => '/admin/tickets'];
    if ($k = (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status='disputed' AND delhivery_dispute IS NULL")) $n[] = ['text' => "$k dispute(s) to forward to Delhivery", 'href' => '/admin/disputes'];
    if ($k = (int) val("SELECT COUNT(*) FROM tickets WHERE status='open'")) $n[] = ['text' => "$k open support ticket(s)", 'href' => '/admin/tickets'];
    if ($k = (int) val("SELECT COUNT(*) FROM complaints WHERE status='open'")) $n[] = ['text' => "$k new customer-care complaint(s)", 'href' => '/admin/support'];
    if ($k = (int) val("SELECT COUNT(*) FROM api_logs WHERE result='failed' AND created_at >= CURDATE()")) $n[] = ['text' => "$k Delhivery API error(s) today", 'href' => '/admin/delhivery'];
    return ['items' => $n];
});

// ---------- customers ----------
function customer_list_where(array &$p): string {
    $w = ["u.role='customer'"];
    if ($q = trim($_GET['q'] ?? '')) { $w[] = '(u.name LIKE ? OR u.business_name LIKE ? OR u.mobile LIKE ? OR u.email LIKE ? OR u.gstin LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%", "%$q%", "%$q%"); }
    if (!empty($_GET['kyc'])) { $w[] = 'u.kyc_status=?'; $p[] = $_GET['kyc']; }
    if (($_GET['markup'] ?? '') === 'custom') $w[] = 'u.markup_pct IS NOT NULL';
    if (($_GET['markup'] ?? '') === 'global') $w[] = 'u.markup_pct IS NULL';
    if (!empty($_GET['status'])) { $w[] = 'u.status=?'; $p[] = $_GET['status']; }
    return implode(' AND ', $w);
}
route('GET', '/admin/customers', function () {
    require_admin('customers');
    $p = []; $w = customer_list_where($p);
    [$a, $b] = period_bounds(null);
    $rows = all("SELECT u.*, (SELECT COUNT(*) FROM shipments s WHERE s.user_id=u.id AND s.is_draft=0) shipments,
        (SELECT COALESCE(SUM(freight+cod_charge),0) FROM shipments s WHERE s.user_id=u.id AND s.is_draft=0 AND s.status<>'cancelled' AND s.created_at BETWEEN '$a' AND '$b') billed_month,
        (SELECT COUNT(*) FROM pickup_addresses pa WHERE pa.user_id=u.id AND pa.delhivery_status='registered') pickups
        FROM users u WHERE $w ORDER BY u.created_at DESC LIMIT 1000", $p);
    $rows = array_map('public_user', $rows);
    if (!empty($_GET['export'])) csv_out('customers.csv', ['ID', 'Business', 'Name', 'Mobile', 'Email', 'GSTIN', 'KYC', 'Wallet', 'Shipments', 'Markup', 'Billed (month)', 'Status', 'Joined'],
        array_map(fn($u) => [$u['id'], $u['business_name'], $u['name'], $u['mobile'], $u['email'], $u['gstin'], $u['kyc_status'], $u['wallet_balance'], $u['shipments'],
            $u['markup_pct'] === null ? 'Global' : $u['markup_pct'] . '%', $u['billed_month'], $u['status'], $u['created_at']], $rows));
    return ['items' => $rows, 'global_markup' => (float) setting('global_markup')];
});
route('GET', '/admin/customers/(\d+)', function ($id) {
    require_admin('customers');
    $u = one("SELECT * FROM users WHERE id=? AND role='customer'", [$id]);
    if (!$u) fail('Not found', 404);
    $u = public_user($u);
    $u['pickups'] = all("SELECT * FROM pickup_addresses WHERE user_id=?", [$id]);
    $u['txns'] = all("SELECT * FROM wallet_txns WHERE user_id=? ORDER BY id DESC LIMIT 50", [$id]);
    $u['stats'] = status_counts('user_id=? AND is_draft=0', [$id]);
    $u['activity'] = all("SELECT a.*, s.name actor FROM activity_logs a LEFT JOIN users s ON s.id=a.actor_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 60", [$id]);
    return $u;
});
function customer_payload(bool $create): array {
    $d = [];
    foreach (['name', 'business_name', 'city', 'mobile', 'email', 'gstin', 'pan', 'monthly_volume', 'bank_name', 'bank_account', 'bank_ifsc', 'markup_reason', 'cod_cycle', 'kyc_note'] as $k)
        if (array_key_exists($k, body())) $d[$k] = trim((string) body()[$k]) ?: null;
    foreach (['status', 'kyc_status'] as $k) if (in($k)) $d[$k] = in($k);
    if (in('kyc_status') && in('kyc_status') !== 'submitted') $d['kyc_reviewed_at'] = date('Y-m-d H:i:s');
    if (array_key_exists('markup_pct', body())) $d['markup_pct'] = (body()['markup_pct'] === '' || body()['markup_pct'] === null) ? null : (float) body()['markup_pct'];
    if (array_key_exists('credit_limit', body())) $d['credit_limit'] = (float) body()['credit_limit'];
    if (isset($d['email'])) $d['email'] = strtolower($d['email']);
    if ($create && (empty($d['name']) || empty($d['email']))) fail('Name and email are required');
    if (in('password')) $d['password_hash'] = password_hash((string) in('password'), PASSWORD_DEFAULT);
    return $d;
}
route('POST', '/admin/customers', function () {
    require_admin('customers');
    $d = customer_payload(true);
    if (val("SELECT id FROM users WHERE email=?", [$d['email']])) fail('Email already exists');
    $d['role'] = 'customer';
    $d['password_hash'] = $d['password_hash'] ?? password_hash(in('password') ?: 'Welcome@123', PASSWORD_DEFAULT);
    $id = insert('users', $d);
    return ['id' => $id, 'default_password' => in('password') ? null : 'Welcome@123'];
});
route('PUT', '/admin/customers/(\d+)', function ($id) {
    require_admin('customers');
    $d = customer_payload(false);
    if (isset($d['email']) && val("SELECT id FROM users WHERE email=? AND id<>?", [$d['email'], $id])) fail('Email already used by another account');
    $before = (string) val("SELECT kyc_status FROM users WHERE id=?", [$id]);
    update('users', $d, "id=? AND role='customer'", [$id]);
    if (isset($d['kyc_status']) && $d['kyc_status'] !== $before && in_array($d['kyc_status'], ['verified', 'rejected'], true))
        notify_user((int) $id, 'kyc_update', ['status' => $d['kyc_status'] === 'verified' ? 'approved' : 'not approved', 'message' => $d['kyc_status'] === 'verified' ? 'You can now add your pickup address, recharge your wallet and book shipments.' : 'Reason: ' . (string) ($d['kyc_note'] ?? 'documents not clear') . '. Please re-upload your documents.'], $d['kyc_status'] === 'verified' ? ['Book a shipment', site_url() . '/book/'] : ['Re-upload KYC', site_url() . '/settings/?tab=kyc']);
    return public_user(one("SELECT * FROM users WHERE id=?", [$id]));
});
route('DELETE', '/admin/customers/(\d+)', function ($id) {
    require_admin('customers');
    if (val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND is_draft=0", [$id]) && !in('force')) fail('Customer has shipments. Block the account instead, or delete with force.');
    foreach (['wallet_txns', 'pickup_addresses', 'weight_disputes', 'cod_remittances', 'invoices', 'tickets'] as $t) q("DELETE FROM $t WHERE user_id=?", [$id]);
    q("DELETE FROM tracking_events WHERE shipment_id IN (SELECT id FROM shipments WHERE user_id=?)", [$id]);
    q("DELETE FROM shipments WHERE user_id=?", [$id]);
    q("DELETE FROM users WHERE id=? AND role='customer'", [$id]);
    return ['ok' => true];
});
route('POST', '/admin/customers/(\d+)/wallet', function ($id) {
    require_admin('wallet');
    $type = in('type') === 'debit' ? 'debit' : 'credit';
    $amt = (float) req('amount'); if ($amt <= 0) fail('Enter amount');
    db()->beginTransaction();
    $bal = wallet_txn((int)$id, $type, $amt, trim((string) in('note', '')) ?: ('Adjustment by admin'), 'ADJ' . time(), 'adjustment');
    db()->commit();
    return ['balance' => $bal];
});
route('POST', '/admin/customers/(\d+)/impersonate', function ($id) {
    $a = require_admin('customers');
    $u = one("SELECT * FROM users WHERE id=? AND role='customer'", [$id]);
    if (!$u) fail('Not found', 404);
    return ['token' => make_token($u, (int)$a['id']), 'user' => public_user($u)];
});
route('POST', '/admin/pickups/(\d+)', function ($id) {
    require_admin('delhivery');
    $p = one("SELECT * FROM pickup_addresses WHERE id=?", [$id]);
    if (!$p) fail('Not found', 404);
    if (in('action') === 'register') delhivery_register_pickup($p);
    elseif (in('status')) update('pickup_addresses', ['delhivery_status' => in('status')], 'id=?', [$id]);
    return one("SELECT * FROM pickup_addresses WHERE id=?", [$id]);
});

// ---------- shipments ----------
route('GET', '/admin/shipments', function () {
    require_admin('shipments');
    $p = []; $where = shipment_filters($p, null);
    $sql = "FROM shipments s JOIN users u ON u.id=s.user_id WHERE $where";
    if (!empty($_GET['export'])) {
        $rows = all("SELECT s.*, u.business_name, u.name cname $sql ORDER BY s.created_at DESC", $p);
        csv_out('all-shipments.csv', ['AWB', 'Order', 'Booked', 'Customer', 'From', 'To', 'Weight', 'Chargeable', 'Mode', 'Service', 'Delhivery base', 'Final (customer)', 'Margin', 'GST', 'Total', 'Status'],
            array_map(fn($s) => [$s['awb'], $s['order_no'], $s['created_at'], $s['business_name'] ?: $s['cname'], $s['from_city'] . ' ' . $s['from_pincode'], $s['to_city'] . ' ' . $s['to_pincode'],
                $s['weight'], $s['chargeable_weight'], $s['payment_mode'], $s['service'], $s['base_rate'] + $s['cod_base'], $s['freight'] + $s['cod_charge'],
                round($s['freight'] + $s['cod_charge'] - $s['base_rate'] - $s['cod_base'], 2), $s['gst'], $s['total'], shipment_row($s)['status_label']], $rows));
    }
    [$lim, $off] = paginate();
    $items = array_map('shipment_row', all("SELECT s.*, u.business_name, u.name cname $sql ORDER BY s.created_at DESC LIMIT $lim OFFSET $off", $p));
    $sum = one("SELECT COUNT(*) n, COALESCE(SUM(s.base_rate+s.cod_base),0) base, COALESCE(SUM(s.freight+s.cod_charge),0) final $sql AND s.status<>'cancelled'", $p);
    return ['items' => $items, 'total' => (int) val("SELECT COUNT(*) $sql", $p), 'summary' => $sum, 'counts' => status_counts('is_draft=0', []),
        'customers' => all("SELECT id, COALESCE(business_name, name) label FROM users WHERE role='customer' ORDER BY label")];
});
route('GET', '/admin/shipments/(\d+)', function ($id) {
    require_admin('shipments');
    $s = one("SELECT * FROM shipments WHERE id=?", [$id]);
    if (!$s) fail('Not found', 404);
    return shipment_detail($s, true);
});
route('PUT', '/admin/shipments/(\d+)', function ($id) {
    require_admin('shipments');
    $d = [];
    foreach (['awb', 'to_name', 'to_phone', 'to_address', 'to_city', 'to_state', 'to_pincode', 'product', 'eta', 'pickup_date', 'pickup_slot', 'courier_weight', 'ndr_reason'] as $k)
        if (array_key_exists($k, body())) $d[$k] = body()[$k] === '' ? null : body()[$k];
    update('shipments', $d, 'id=?', [$id]);
    return shipment_detail(one("SELECT * FROM shipments WHERE id=?", [$id]), true);
});
route('POST', '/admin/shipments/(\d+)/status', function ($id) {
    require_admin('shipments');
    $s = one("SELECT * FROM shipments WHERE id=?", [$id]);
    if (!$s) fail('Not found', 404);
    $st = (string) req('status');
    if (!isset(STATUS_LABEL[$st])) fail('Invalid status');
    db()->beginTransaction();
    if ($st === 'cancelled' && $s['status'] !== 'cancelled' && in('refund')) wallet_txn((int)$s['user_id'], 'credit', (float)$s['total'], 'Refund · cancelled ' . $s['awb'], $s['awb'], 'refund');
    apply_status($s, $st, (string) in('label', ''), (string) in('location', ''), (string) in('remark', ''), in('time') ? date('Y-m-d H:i:s', strtotime((string) in('time'))) : null);
    db()->commit();
    return shipment_detail(one("SELECT * FROM shipments WHERE id=?", [$id]), true);
});
route('DELETE', '/admin/events/(\d+)', function ($id) { require_admin('shipments'); q("DELETE FROM tracking_events WHERE id=?", [$id]); return ['ok' => true]; });
route('POST', '/admin/shipments/(\d+)/discrepancy', function ($id) {
    require_admin('disputes');
    $s = one("SELECT * FROM shipments WHERE id=?", [$id]);
    if (!$s) fail('Not found', 404);
    if (val("SELECT id FROM weight_disputes WHERE shipment_id=? AND status IN ('open','disputed')", [$id])) fail('This shipment already has an open discrepancy');
    $cw = (float) req('courier_weight');
    $did = create_dispute($s, $cw, (string) in('courier_dims', ''), array_filter(array_map('intval', (array) in('proof_ids', []))), null, 'open', (string) in('proof_labels', ''));
    update('shipments', ['courier_weight' => $cw], 'id=?', [$id]);
    return one("SELECT * FROM weight_disputes WHERE id=?", [$did]);
});
route('POST', '/admin/sync', function () { require_admin('shipments'); return delhivery_sync(); });

// ---------- rates & markup ----------
route('GET', '/admin/rates', function () {
    require_admin('rates');
    return [
        'global_markup' => (float) setting('global_markup'), 'rate_card' => all("SELECT * FROM rate_card ORDER BY service, zone"), 'zones' => ZONE_LABEL,
        'settings' => array_intersect_key(settings(), array_flip(['cod_fixed', 'cod_pct', 'cod_rule_text', 'rto_pct', 'rto_rule_text', 'wd_rule_text', 'rounding', 'gst_pct', 'vol_divisor',
            'surface_days', 'surface_eta', 'express_days', 'express_eta', 'service_surface_enabled', 'service_express_enabled'])),
        'custom' => all("SELECT id, COALESCE(business_name,name) label, markup_pct, markup_reason FROM users WHERE role='customer' AND markup_pct IS NOT NULL ORDER BY label"),
        'customers' => all("SELECT id, COALESCE(business_name,name) label FROM users WHERE role='customer' ORDER BY label"),
    ];
});
route('PUT', '/admin/rates', function () {
    require_admin('rates');
    if (in('global_markup') !== null) { $g = (float) in('global_markup'); if ($g < 0 || $g > 500) fail('Markup must be 0–500%'); set_setting('global_markup', $g); }
    foreach ((array) in('rate_card', []) as $r) q("UPDATE rate_card SET first_500=?, add_500=? WHERE service=? AND zone=?", [(float)$r['first_500'], (float)$r['add_500'], $r['service'], $r['zone']]);
    foreach ((array) in('settings', []) as $k => $v) if (in_array($k, ['cod_fixed', 'cod_pct', 'cod_rule_text', 'rto_pct', 'rto_rule_text', 'wd_rule_text', 'rounding', 'gst_pct', 'vol_divisor',
        'surface_days', 'surface_eta', 'express_days', 'express_eta', 'service_surface_enabled', 'service_express_enabled'])) set_setting($k, $v);
    return ['ok' => true];
});

// ---------- weight disputes ----------
route('GET', '/admin/disputes', function () {
    require_admin('disputes');
    sweep_disputes();
    $w = '1=1'; $p = [];
    if (!empty($_GET['status'])) { $w = 'd.status=?'; $p[] = $_GET['status']; }
    $m = date('Y-m-01');
    return [
        'items' => all("SELECT d.*, COALESCE(u.business_name,u.name) customer FROM weight_disputes d JOIN users u ON u.id=d.user_id WHERE $w ORDER BY FIELD(d.status,'open','disputed','accepted','resolved'), d.id DESC LIMIT 500", $p),
        'stats' => [
            'open' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status='open'"),
            'open_amount' => (float) val("SELECT COALESCE(SUM(customer_extra),0) FROM weight_disputes WHERE status='open'"),
            'disputed' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status='disputed'"),
            'sent' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE status='disputed' AND delhivery_dispute IS NOT NULL"),
            'recovered' => (float) val("SELECT COALESCE(SUM(charged_amount),0) FROM weight_disputes WHERE status='accepted' AND resolved_at >= ?", [$m]),
            'won' => (float) val("SELECT COALESCE(SUM(base_extra),0) FROM weight_disputes WHERE outcome='won' AND resolved_at >= ?", [$m]),
        ],
        'auto_accept' => setting('auto_accept') === '1', 'auto_accept_days' => (int) setting('auto_accept_days', 7),
    ];
});
route('POST', '/admin/disputes/(\d+)', function ($id) {
    require_admin('disputes');
    $d = one("SELECT * FROM weight_disputes WHERE id=?", [$id]);
    if (!$d) fail('Not found', 404);
    $act = (string) req('action');
    if ($act === 'forward') update('weight_disputes', ['delhivery_dispute' => in('note') ?: 'Raised on Delhivery'], 'id=?', [$id]);
    elseif ($act === 'accept') accept_dispute($d, 'Accepted (by admin)');
    elseif ($act === 'won') {
        update('weight_disputes', ['status' => 'resolved', 'outcome' => 'won', 'delhivery_dispute' => 'Won ✓ refund', 'resolved_at' => date('Y-m-d H:i:s')], 'id=?', [$id]);
        update('shipments', ['wd_open' => 0], 'id=?', [$d['shipment_id']]);
        if ((float)$d['charged_amount'] > 0) { db()->beginTransaction(); wallet_txn((int)$d['user_id'], 'credit', (float)$d['charged_amount'], 'Weight dispute refund ' . $d['awb'], $d['awb'], 'refund'); db()->commit(); }
    } elseif ($act === 'lost') {
        accept_dispute($d, 'Dispute rejected by Delhivery');
        update('weight_disputes', ['status' => 'resolved', 'outcome' => 'lost', 'delhivery_dispute' => 'Lost — charged'], 'id=?', [$id]);
    } elseif ($act === 'delete') {
        q("DELETE FROM weight_disputes WHERE id=?", [$id]);
        update('shipments', ['wd_open' => 0], 'id=?', [$d['shipment_id']]);
    } else fail('Unknown action');
    return ['ok' => true];
});
route('PUT', '/admin/disputes/settings', function () {
    require_admin('disputes');
    if (in('auto_accept') !== null) set_setting('auto_accept', in('auto_accept') ? '1' : '0');
    if (in('auto_accept_days')) set_setting('auto_accept_days', max(1, (int) in('auto_accept_days')));
    return ['ok' => true];
});

// ---------- NDR ----------
route('GET', '/admin/ndr', function () {
    require_admin('ndr');
    $items = all("SELECT s.*, COALESCE(u.business_name,u.name) customer FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.status IN ('ndr','rto_in_transit','rto_delivered') ORDER BY FIELD(s.status,'ndr','rto_in_transit','rto_delivered'), s.updated_at DESC LIMIT 500");
    $tot = (int) val("SELECT COUNT(*) FROM shipments WHERE is_draft=0 AND created_at >= ?", [date('Y-m-d', strtotime('-30 days'))]);
    $rto = (int) val("SELECT COUNT(*) FROM shipments WHERE status IN ('rto_in_transit','rto_delivered') AND created_at >= ?", [date('Y-m-d', strtotime('-30 days'))]);
    return ['items' => array_map('shipment_row', $items), 'stats' => [
        'ndr' => (int) val("SELECT COUNT(*) FROM shipments WHERE status='ndr'"), 'ndr_no_action' => (int) val("SELECT COUNT(*) FROM shipments WHERE status='ndr' AND ndr_action IS NULL"),
        'rto_transit' => (int) val("SELECT COUNT(*) FROM shipments WHERE status='rto_in_transit'"),
        'rto_delivered' => (int) val("SELECT COUNT(*) FROM shipments WHERE status='rto_delivered' AND updated_at >= ?", [date('Y-m-01')]),
        'rto_rate' => $tot ? round($rto / $tot * 100, 1) : 0]];
});

// ---------- wallet & COD ----------
route('GET', '/admin/cod', function () {
    require_admin('wallet');
    return [
        'early_fee_pct' => (float) setting('early_cod_fee_pct', 1),
        'pending' => all("SELECT u.id user_id, COALESCE(u.business_name,u.name) customer, u.bank_name, u.bank_account, u.cod_cycle, u.early_cod,
            SUM(s.cod_amount) collected, SUM(CASE WHEN s.cod_status='received' THEN s.cod_amount ELSE 0 END) received, COUNT(*) n
            FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.cod_status IN ('pending','received') GROUP BY u.id ORDER BY collected DESC"),
        'remittances' => all("SELECT r.*, COALESCE(u.business_name,u.name) customer FROM cod_remittances r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 100"),
        'next_remittance' => setting('cod_next_remittance'),
        'txns' => all("SELECT t.*, COALESCE(u.business_name,u.name) customer FROM wallet_txns t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 100"),
        'invoices' => all("SELECT i.*, COALESCE(u.business_name,u.name) customer FROM invoices i JOIN users u ON u.id=i.user_id ORDER BY i.period DESC, i.id DESC LIMIT 200"),
        'wallet_total' => (float) val("SELECT COALESCE(SUM(wallet_balance),0) FROM users WHERE role='customer'"),
    ];
});
route('POST', '/admin/cod/receive', function () {
    require_admin('wallet');
    q("UPDATE shipments SET cod_status='received' WHERE user_id=? AND cod_status='pending'", [(int) req('user_id')]);
    return ['ok' => true];
});
route('POST', '/admin/cod/remit', function () {
    require_admin('wallet');
    $uid = (int) req('user_id');
    $rows = all("SELECT id, cod_amount FROM shipments WHERE user_id=? AND cod_status IN ('pending','received')", [$uid]);
    if (!$rows) fail('Nothing to remit');
    $gross = array_sum(array_column($rows, 'cod_amount'));
    $early = (int) val("SELECT early_cod FROM users WHERE id=?", [$uid]);
    $fee = $early ? round($gross * (float) setting('early_cod_fee_pct', 1) / 100, 2) : 0;
    $amt = $gross - $fee;
    $toWallet = (bool) in('to_wallet');
    db()->beginTransaction();
    $rid = insert('cod_remittances', ['user_id' => $uid, 'amount' => $amt, 'gross' => $gross, 'fee' => $fee, 'wallet_used' => $toWallet ? $amt : 0, 'amount_paid' => $toWallet ? 0 : $amt, 'paid_at' => date('Y-m-d H:i:s'), 'shipments' => count($rows), 'utr' => in('utr') ?: ($toWallet ? 'WALLET' : null), 'status' => 'paid', 'remit_date' => date('Y-m-d')]);
    q("UPDATE shipments SET cod_status='remitted', remittance_id=? WHERE id IN (" . implode(',', array_column($rows, 'id')) . ")", [$rid]);
    update('cod_remittances', ['ref_no' => 'CODR' . str_pad((string) $rid, 6, '0', STR_PAD_LEFT)], 'id=?', [$rid]);
    if ($toWallet) wallet_txn($uid, 'credit', $amt, 'COD remittance adjusted', 'CODR' . str_pad((string) $rid, 6, '0', STR_PAD_LEFT), 'cod');
    db()->commit();
    return ['ok' => true, 'amount' => $amt];
});
route('PUT', '/admin/cod/settings', function () { require_admin('wallet'); if (in('next_remittance')) set_setting('cod_next_remittance', in('next_remittance')); return ['ok' => true]; });
route('POST', '/admin/invoices/generate', function () {
    require_admin('wallet');
    [$a, $b, $m] = period_bounds((string) in('period', date('Y-m', strtotime('first day of last month'))));
    $gst = (float) setting('gst_pct', 18);
    $made = 0;
    foreach (all("SELECT user_id, COUNT(*) n, SUM(freight+cod_charge) taxable, SUM(gst) g FROM shipments WHERE is_draft=0 AND status<>'cancelled' AND created_at BETWEEN ? AND ? GROUP BY user_id", [$a, $b]) as $r) {
        $ex = one("SELECT id FROM invoices WHERE user_id=? AND period=?", [$r['user_id'], $m]);
        $data = ['shipments' => $r['n'], 'taxable' => $r['taxable'], 'gst' => $r['g'], 'amount' => round($r['taxable'] + $r['g'], 2)];
        if ($ex) update('invoices', $data, 'id=?', [$ex['id']]);
        else { $n = (int) val("SELECT COUNT(*) FROM invoices") + 1001; insert('invoices', $data + ['user_id' => $r['user_id'], 'period' => $m, 'number' => setting('invoice_prefix', 'VS/INV/') . $n]); }
        $made++;
    }
    return ['ok' => true, 'count' => $made, 'period' => $m];
});
route('GET', '/admin/invoices/(\d+)', function ($id) {
    require_admin('wallet');
    $inv = one("SELECT * FROM invoices WHERE id=?", [$id]);
    if (!$inv) fail('Not found', 404);
    return invoice_detail($inv);
});
route('DELETE', '/admin/invoices/(\d+)', function ($id) { require_admin('wallet'); q("DELETE FROM invoices WHERE id=?", [$id]); return ['ok' => true]; });

// ---------- reports ----------
route('GET', '/admin/reports', function () {
    require_admin('reports');
    [$a, $b, $m] = period_bounds($_GET['month'] ?? null);
    $trend = [];
    for ($i = 5; $i >= 0; $i--) {
        $mm = date('Y-m', strtotime("$m-01 -$i month"));
        [$x, $y] = period_bounds($mm);
        $trend[] = ['month' => $mm, 'label' => date('M', strtotime("$mm-01"))] + money_stats($x, $y);
    }
    $prev = period_bounds(date('Y-m', strtotime("$m-01 -1 month")));
    $cur = money_stats($a, $b); $pv = money_stats($prev[0], $prev[1]);
    $codPending = all("SELECT COALESCE(u.business_name,u.name) customer, u.id user_id, SUM(s.cod_amount) collected, SUM(CASE WHEN s.cod_status='received' THEN s.cod_amount ELSE 0 END) received
        FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.cod_status IN ('pending','received') GROUP BY u.id ORDER BY collected DESC LIMIT 20");
    $paid = all("SELECT COALESCE(u.business_name,u.name) customer, r.amount collected, r.amount received, r.remit_date FROM cod_remittances r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 5");
    return ['month' => $m, 'money' => $cur, 'growth' => $pv['billed'] ? round(($cur['billed'] - $pv['billed']) / $pv['billed'] * 100, 1) : null, 'trend' => $trend,
        'cod_to_remit' => (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE cod_status IN ('pending','received')"),
        'cod_customers' => (int) val("SELECT COUNT(DISTINCT user_id) FROM shipments WHERE cod_status IN ('pending','received')"),
        'cod_pending' => $codPending, 'cod_paid' => $paid, 'next_remittance' => setting('cod_next_remittance')];
});
route('GET', '/admin/reports/export', function () {
    require_admin('reports');
    [$a, $b, $m] = period_bounds($_GET['month'] ?? null);
    $type = $_GET['type'] ?? 'pl';
    switch ($type) {
        case 'pl':
            $rows = all("SELECT COALESCE(u.business_name,u.name) c, COUNT(*) n, SUM(s.freight+s.cod_charge) billed, SUM(s.base_rate+s.cod_base) cost, SUM(s.freight+s.cod_charge-s.base_rate-s.cod_base) margin
                FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.is_draft=0 AND s.status<>'cancelled' AND s.created_at BETWEEN ? AND ? GROUP BY u.id ORDER BY billed DESC", [$a, $b]);
            csv_out("customer-pl-$m.csv", ['Customer', 'Shipments', 'Billed', 'Delhivery cost', 'Margin'], $rows);
        case 'base_final':
            $rows = all("SELECT s.awb, COALESCE(u.business_name,u.name), s.created_at, s.zone, s.chargeable_weight, s.base_rate+s.cod_base, s.freight+s.cod_charge, s.freight+s.cod_charge-s.base_rate-s.cod_base
                FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.is_draft=0 AND s.created_at BETWEEN ? AND ? ORDER BY s.created_at", [$a, $b]);
            csv_out("base-vs-final-$m.csv", ['AWB', 'Customer', 'Booked', 'Zone', 'Chargeable kg', 'Base', 'Final', 'Margin'], $rows);
        case 'zone':
            csv_out("zone-wise-$m.csv", ['Zone', 'Shipments', 'Billed', 'Cost', 'Margin'], all("SELECT zone, COUNT(*), SUM(freight+cod_charge), SUM(base_rate+cod_base), SUM(freight+cod_charge-base_rate-cod_base) FROM shipments WHERE is_draft=0 AND status<>'cancelled' AND created_at BETWEEN ? AND ? GROUP BY zone", [$a, $b]));
        case 'status':
            csv_out("status-wise-$m.csv", ['Status', 'Shipments'], all("SELECT status, COUNT(*) FROM shipments WHERE is_draft=0 AND created_at BETWEEN ? AND ? GROUP BY status", [$a, $b]));
        case 'rto':
            csv_out("rto-$m.csv", ['Customer', 'Shipments', 'RTO', 'RTO %'], all("SELECT COALESCE(u.business_name,u.name), COUNT(*), SUM(s.status IN ('rto_in_transit','rto_delivered')), ROUND(SUM(s.status IN ('rto_in_transit','rto_delivered'))/COUNT(*)*100,1) FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.is_draft=0 AND s.created_at BETWEEN ? AND ? GROUP BY u.id", [$a, $b]));
        case 'weight':
            csv_out("weight-discrepancy-$m.csv", ['AWB', 'Customer', 'Declared', 'Courier', 'Charged on', 'Extra base', 'Extra customer', 'Status', 'Delhivery'], all("SELECT d.awb, COALESCE(u.business_name,u.name), d.declared_weight, d.courier_weight, d.charged_weight, d.base_extra, d.customer_extra, d.status, d.delhivery_dispute FROM weight_disputes d JOIN users u ON u.id=d.user_id WHERE d.created_at BETWEEN ? AND ?", [$a, $b]));
        case 'cod':
            csv_out("cod-remittance-$m.csv", ['Customer', 'Amount', 'Shipments', 'UTR', 'Date'], all("SELECT COALESCE(u.business_name,u.name), r.amount, r.shipments, r.utr, r.remit_date FROM cod_remittances r JOIN users u ON u.id=r.user_id WHERE r.created_at BETWEEN ? AND ?", [$a, $b]));
        case 'wallet':
            csv_out("wallet-ledger-$m.csv", ['Date', 'Customer', 'Type', 'Amount', 'Balance', 'Description'], all("SELECT t.created_at, COALESCE(u.business_name,u.name), t.type, t.amount, t.balance_after, t.description FROM wallet_txns t JOIN users u ON u.id=t.user_id WHERE t.created_at BETWEEN ? AND ? ORDER BY t.id", [$a, $b]));
        case 'gst':
            csv_out("gst-invoice-register-$m.csv", ['Invoice', 'Customer', 'GSTIN', 'Period', 'Shipments', 'Taxable', 'GST', 'Total'], all("SELECT i.number, COALESCE(u.business_name,u.name), u.gstin, i.period, i.shipments, i.taxable, i.gst, i.amount FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.period=?", [$m]));
    }
    fail('Unknown report');
});

// ---------- Delhivery integration ----------
route('GET', '/admin/delhivery', function () {
    require_admin('delhivery');
    $tok = setting('delhivery_token', '');
    return [
        'mode' => setting('delhivery_mode'), 'env' => setting('delhivery_env'), 'client' => setting('delhivery_client'), 'default_service' => setting('delhivery_default_service'),
        'token_masked' => $tok ? str_repeat('•', 16) . substr($tok, -4) : '', 'has_token' => $tok !== '', 'connected' => delhivery_live(),
        'sync_minutes' => setting('delhivery_sync_minutes'),
        'pickups' => all("SELECT p.*, COALESCE(u.business_name,u.name) customer FROM pickup_addresses p JOIN users u ON u.id=p.user_id ORDER BY p.delhivery_status DESC, p.id DESC LIMIT 200"),
        'logs' => all("SELECT id, api, request, result, created_at FROM api_logs ORDER BY id DESC LIMIT 100"),
        'calls_24h' => (int) val("SELECT COUNT(*) FROM api_logs WHERE created_at >= NOW() - INTERVAL 1 DAY"),
        'failed_24h' => (int) val("SELECT COUNT(*) FROM api_logs WHERE result='failed' AND created_at >= NOW() - INTERVAL 1 DAY"),
    ];
});
route('PUT', '/admin/delhivery', function () {
    require_admin('delhivery');
    foreach (['mode' => 'delhivery_mode', 'env' => 'delhivery_env', 'client' => 'delhivery_client', 'default_service' => 'delhivery_default_service', 'sync_minutes' => 'delhivery_sync_minutes'] as $in => $k)
        if (in($in) !== null) set_setting($k, in($in));
    if (in('token')) set_setting('delhivery_token', trim((string) in('token')));
    if (in('clear_token')) set_setting('delhivery_token', '');
    return ['ok' => true];
});
route('POST', '/admin/delhivery/test', function () { require_admin('delhivery'); return delhivery_test(); });
route('GET', '/admin/logs/(\d+)', function ($id) { require_admin('delhivery'); return one("SELECT * FROM api_logs WHERE id=?", [$id]); });

// ---------- staff & roles ----------
route('GET', '/admin/staff', function () {
    require_admin('staff');
    return ['items' => array_map('public_user', all("SELECT * FROM users WHERE role IN ('admin','staff') ORDER BY role, id")), 'sections' => ADMIN_SECTIONS];
});
route('POST', '/admin/staff', function () {
    require_admin('staff');
    $email = strtolower(trim((string) req('email')));
    if (val("SELECT id FROM users WHERE email=?", [$email])) fail('Email already exists');
    $role = in('role') === 'admin' ? 'admin' : 'staff';
    $id = insert('users', ['role' => $role, 'staff_role' => in('staff_role', $role === 'admin' ? 'Admin' : 'Staff'), 'name' => req('name'), 'email' => $email, 'mobile' => in('mobile'),
        'password_hash' => password_hash((string) req('password'), PASSWORD_DEFAULT), 'permissions' => json_encode(array_values(array_intersect((array) in('permissions', []), ADMIN_SECTIONS))), 'kyc_status' => 'verified']);
    return ['id' => $id];
});
route('PUT', '/admin/staff/(\d+)', function ($id) {
    $me = require_admin('staff');
    $d = [];
    foreach (['name', 'mobile', 'staff_role', 'status'] as $k) if (in($k) !== null) $d[$k] = in($k);
    if (in('role')) $d['role'] = in('role') === 'admin' ? 'admin' : 'staff';
    if (in('permissions') !== null) $d['permissions'] = json_encode(array_values(array_intersect((array) in('permissions'), ADMIN_SECTIONS)));
    if (in('password')) $d['password_hash'] = password_hash((string) in('password'), PASSWORD_DEFAULT);
    if ((int)$id === (int)$me['id'] && (($d['role'] ?? 'admin') !== 'admin' && $me['role'] === 'admin' || ($d['status'] ?? 'active') === 'blocked')) fail("You can't demote or block yourself");
    update('users', $d, "id=? AND role IN ('admin','staff')", [$id]);
    return ['ok' => true];
});
route('DELETE', '/admin/staff/(\d+)', function ($id) {
    $me = require_admin('staff');
    if ((int)$id === (int)$me['id']) fail("You can't delete yourself");
    if (one("SELECT role FROM users WHERE id=?", [$id])['role'] === 'admin' && (int) val("SELECT COUNT(*) FROM users WHERE role='admin'") <= 1) fail('At least one admin is required');
    q("DELETE FROM users WHERE id=? AND role IN ('admin','staff')", [$id]);
    return ['ok' => true];
});

// ---------- website content & general settings ----------
route('GET', '/admin/content', function () { require_admin('content'); return ['content' => content()]; });
route('PUT', '/admin/content', function () {
    require_admin('content');
    $c = (array) in('content', []);
    set_setting('content', array_merge(content(), $c));
    return ['ok' => true];
});
const GENERAL_KEYS = ['company_name', 'company_gstin', 'company_address', 'company_city', 'company_state', 'company_pincode', 'company_phone', 'invoice_prefix', 'require_kyc', 'min_recharge', 'low_wallet_threshold', 'pickup_slots',
    'gst_pct', 'early_cod_fee_pct', 'early_cod_cycle', 'notif_credit_price', 'notif_provider_enabled', 'notif_provider_name', 'cod_confirm_enabled'];
route('GET', '/admin/settings', function () {
    require_admin('content');
    $s = array_intersect_key(settings(), array_flip(GENERAL_KEYS));
    $s['razorpay_secret_set'] = setting('razorpay_key_secret', '') !== '';
    return $s;
});
route('PUT', '/admin/settings', function () {
    require_admin('content');
    foreach (body() as $k => $v) if (in_array($k, GENERAL_KEYS)) set_setting($k, $v);
    return ['ok' => true];
});

// ---------- support ----------
route('GET', '/admin/support', function () {
    require_admin('support');
    return [
        'tickets' => all("SELECT t.*, COALESCE(u.business_name,u.name) customer, s.awb FROM tickets t JOIN users u ON u.id=t.user_id LEFT JOIN shipments s ON s.id=t.shipment_id ORDER BY t.status='closed', t.id DESC LIMIT 200"),
        'enquiries' => all("SELECT * FROM enquiries ORDER BY id DESC LIMIT 200"),
        'deletions' => all("SELECT id, name, business_name, email, mobile, wallet_balance, deletion_requested_at, deletion_reason FROM users WHERE deletion_requested_at IS NOT NULL ORDER BY deletion_requested_at DESC"),
    ];
});
route('DELETE', '/admin/enquiries/(\d+)', function ($id) { require_admin('support'); q("DELETE FROM enquiries WHERE id=?", [$id]); return ['ok' => true]; });
route('POST', '/admin/demo/clear', function () {
    require_admin('staff');
    $ids = array_column(all("SELECT id FROM users WHERE is_demo=1"), 'id');
    foreach ($ids as $id) {
        foreach (['wallet_txns', 'pickup_addresses', 'weight_disputes', 'cod_remittances', 'invoices', 'tickets'] as $t) q("DELETE FROM $t WHERE user_id=?", [$id]);
        q("DELETE FROM tracking_events WHERE shipment_id IN (SELECT id FROM shipments WHERE user_id=?)", [$id]);
        q("DELETE FROM shipments WHERE user_id=?", [$id]);
        q("DELETE FROM users WHERE id=?", [$id]);
    }
    q("DELETE FROM api_logs");
    return ['ok' => true, 'removed' => count($ids)];
});

// ---------- Shipmozo + provider switches ----------
route('GET', '/admin/shipmozo', function () {
    require_admin('delhivery');
    $pk = setting('shipmozo_private_key', '');
    return ['enabled' => setting('shipmozo_enabled') === '1', 'public_key' => setting('shipmozo_public_key'), 'private_masked' => $pk ? str_repeat('•', 12) . substr($pk, -4) : '',
        'has_private' => $pk !== '', 'base' => setting('shipmozo_base'), 'warehouse_id' => setting('shipmozo_warehouse_id'), 'package_type' => setting('shipmozo_package_type'), 'b2b_package_type' => setting('shipmozo_b2b_package_type', 'B2B'),
        'rov_type' => setting('shipmozo_rov_type'), 'max_options' => setting('shipmozo_max_options'), 'schedule_pickup' => setting('shipmozo_schedule_pickup'),
        'delhivery_enabled' => setting('delhivery_enabled', '1') === '1', 'live' => shipmozo_on(),
        'shipments' => (int) val("SELECT COUNT(*) FROM shipments WHERE provider='shipmozo'")];
});
route('PUT', '/admin/shipmozo', function () {
    require_admin('delhivery');
    foreach (['enabled' => 'shipmozo_enabled', 'public_key' => 'shipmozo_public_key', 'base' => 'shipmozo_base', 'warehouse_id' => 'shipmozo_warehouse_id', 'package_type' => 'shipmozo_package_type', 'b2b_package_type' => 'shipmozo_b2b_package_type',
        'rov_type' => 'shipmozo_rov_type', 'max_options' => 'shipmozo_max_options', 'schedule_pickup' => 'shipmozo_schedule_pickup', 'delhivery_enabled' => 'delhivery_enabled'] as $in => $k) {
        $v = in($in);
        if ($v === null) continue;
        if (is_bool($v)) $v = $v ? '1' : '0';
        set_setting($k, is_string($v) ? trim($v) : $v);
    }
    if (in('private_key')) set_setting('shipmozo_private_key', trim((string) in('private_key')));
    if (in('clear_keys')) { set_setting('shipmozo_private_key', ''); set_setting('shipmozo_public_key', ''); set_setting('shipmozo_enabled', '0'); }
    return ['ok' => true];
});
route('POST', '/admin/shipmozo/test', function () { require_admin('delhivery'); return shipmozo_test(); });
route('GET', '/admin/dlvb2b', function () {
    require_admin('delhivery');
    $pw = setting('dlvb2b_password', '');
    return ['enabled' => setting('dlvb2b_enabled') === '1', 'username' => setting('dlvb2b_username'), 'has_password' => $pw !== '', 'password_masked' => $pw ? str_repeat('•', 10) : '',
        'base' => setting('dlvb2b_base'), 'min_kg' => setting('dlvb2b_min_kg', '10'), 'freight_mode' => setting('dlvb2b_freight_mode', 'fop'), 'rov' => setting('dlvb2b_rov', '0') === '1',
        'company_gstin' => setting('company_gstin'), 'live' => b2b_on(), 'shipments' => (int) val("SELECT COUNT(*) FROM shipments WHERE provider='dlvb2b'")];
});
route('PUT', '/admin/dlvb2b', function () {
    require_admin('delhivery');
    foreach (['enabled' => 'dlvb2b_enabled', 'username' => 'dlvb2b_username', 'base' => 'dlvb2b_base', 'min_kg' => 'dlvb2b_min_kg', 'freight_mode' => 'dlvb2b_freight_mode', 'rov' => 'dlvb2b_rov'] as $in => $k) {
        $v = in($in);
        if ($v === null) continue;
        if (is_bool($v)) $v = $v ? '1' : '0';
        set_setting($k, is_string($v) ? trim($v) : (string) $v);
    }
    if (in('password')) { set_setting('dlvb2b_password', (string) in('password')); set_setting('dlvb2b_jwt', ''); set_setting('dlvb2b_fail_at', '0'); }
    if (in('username') !== null) set_setting('dlvb2b_jwt', '');
    if (in('clear')) { foreach (['dlvb2b_password', 'dlvb2b_username', 'dlvb2b_jwt'] as $k) set_setting($k, ''); set_setting('dlvb2b_enabled', '0'); }
    return ['ok' => true];
});
route('POST', '/admin/dlvb2b/test', function () { require_admin('delhivery'); return b2b_test(); });
route('POST', '/admin/quote-preview', function () {
    require_admin();
    $u = in('customer_id') ? one("SELECT * FROM users WHERE id=?", [(int) in('customer_id')]) : null;
    return quote((string) req('from'), (string) req('to'), (float) req('weight'), in('l', 10), in('b', 10), in('h', 10), in('payment', 'prepaid') === 'cod' ? 'cod' : 'prepaid', (float) in('cod_amount', 0), $u);
});

// ---------- carriers registry (Add Carrier) ----------
// Stores a new carrier partner's API details so its connector can be switched on later.
// Booking connectors exist for Shipmozo, Delhivery and Delhivery Cargo; other carriers are saved here until their API is wired in.
function carrier_out(array $c): array {
    $cred = json_decode((string) ($c['credentials'] ?? ''), true) ?: [];
    $c['credentials'] = array_map(fn($v) => $v === '' ? '' : str_repeat('•', 6) . substr((string) $v, -3), $cred);
    $c['credential_keys'] = array_keys($cred);
    return $c;
}
route('GET', '/admin/carriers', function () {
    require_admin('delhivery');
    return ['items' => array_map('carrier_out', all("SELECT * FROM carriers ORDER BY id DESC"))];
});
route('POST', '/admin/carriers', function () {
    require_admin('delhivery');
    $name = trim((string) req('name'));
    if ($name === '') fail('Carrier name is required');
    $cred = [];
    foreach ((array) in('credentials', []) as $k => $v) { $k = preg_replace('/[^a-z0-9_ ]/i', '', (string) $k); if ($k !== '' && trim((string) $v) !== '') $cred[$k] = trim((string) $v); }
    $id = insert('carriers', ['name' => $name, 'code' => strtolower(preg_replace('/[^a-z0-9]+/i', '_', $name)), 'logo_file_id' => (int) in('logo_file_id', 0) ?: null,
        'website' => in('website'), 'api_base' => in('api_base'), 'auth_type' => in('auth_type', 'api_key'), 'credentials' => json_encode($cred),
        'services' => in('services'), 'modes' => in('modes'), 'contact_name' => in('contact_name'), 'contact_phone' => in('contact_phone'), 'contact_email' => in('contact_email'),
        'notes' => in('notes'), 'status' => 'pending', 'enabled' => 0]);
    return carrier_out(one("SELECT * FROM carriers WHERE id=?", [$id]));
});
route('PUT', '/admin/carriers/(\d+)', function ($id) {
    require_admin('delhivery');
    $c = one("SELECT * FROM carriers WHERE id=?", [$id]); if (!$c) fail('Not found', 404);
    $d = [];
    foreach (['name', 'website', 'api_base', 'auth_type', 'services', 'modes', 'contact_name', 'contact_phone', 'contact_email', 'notes'] as $k) if (in($k) !== null) $d[$k] = in($k);
    if (in('logo_file_id') !== null) $d['logo_file_id'] = (int) in('logo_file_id') ?: null;
    if (in('credentials') !== null) {
        $cred = json_decode((string) $c['credentials'], true) ?: [];
        foreach ((array) in('credentials') as $k => $v) { $k = preg_replace('/[^a-z0-9_ ]/i', '', (string) $k); if ($k === '') continue; if ($v === null) unset($cred[$k]); elseif (trim((string) $v) !== '' && !str_contains((string) $v, '•')) $cred[$k] = trim((string) $v); }
        $d['credentials'] = json_encode($cred);
    }
    $d['updated_at'] = date('Y-m-d H:i:s');
    update('carriers', $d, 'id=?', [$id]);
    return carrier_out(one("SELECT * FROM carriers WHERE id=?", [$id]));
});
route('DELETE', '/admin/carriers/(\d+)', function ($id) { require_admin('delhivery'); q("DELETE FROM carriers WHERE id=?", [$id]); return ['ok' => true]; });
route('POST', '/admin/carriers/(\d+)/test', function ($id) {
    require_admin('delhivery');
    $c = one("SELECT * FROM carriers WHERE id=?", [$id]); if (!$c) fail('Not found', 404);
    if (!$c['api_base'] || !preg_match('#^https://#', $c['api_base'])) fail('Add the carrier API base URL (https://…) first');
    $ch = curl_init($c['api_base']);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_NOBODY => false, CURLOPT_FOLLOWLOCATION => false]);
    curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $msg = $err ? 'Not reachable: ' . $err : 'API server reachable (HTTP ' . $code . ')';
    update('carriers', ['last_test' => date('d M H:i') . ' · ' . $msg, 'status' => $err ? $c['status'] : ($c['status'] === 'pending' ? 'credentials_saved' : $c['status'])], 'id=?', [$id]);
    return ['ok' => !$err, 'message' => $msg . ($err ? '' : ' — credentials saved; booking goes live once this carrier\'s connector is enabled.')];
});

// ---------- services & rate cards (per-service pricing) ----------
function services_for_admin(): array {
    $list = [];
    foreach (svc_catalog() as $k => $c) $list[] = ['key' => $k, 'label' => $c['label'], 'kind' => $c['kind'], 'cards' => $c['cards'], 'builtin' => true,
        'connected' => match ($k) { 'shipmozo_b2c', 'shipmozo_b2b' => shipmozo_on(), 'delhivery_b2c' => delhivery_live(), 'delhivery_b2b' => b2b_on(), default => false }];
    foreach (all("SELECT * FROM carriers ORDER BY name") as $c)
        $list[] = ['key' => 'carrier_' . $c['id'], 'label' => $c['name'], 'kind' => strtolower((string) $c['modes']), 'cards' => ['c' . $c['id'] => $c['name']], 'builtin' => false,
            'connected' => (bool) $c['enabled'], 'carrier_id' => (int) $c['id'], 'logo' => courier_logo($c['name'], $c['logo_file_id'] ? (int) $c['logo_file_id'] : null)];
    foreach ($list as &$s) {
        $s['pricing'] = svc_pricing($s['key']);
        if (!$s['builtin']) $s['pricing']['mode'] = 'card';
        $s['rates'] = [];
        foreach (array_keys($s['cards']) as $ck) {
            $rows = []; foreach (all("SELECT zone, first_500, add_500, base_kg, step_kg FROM rate_card WHERE service=?", [$ck]) as $r) $rows[$r['zone']] = $r;
            foreach (array_keys(ZONE_LABEL) as $z) $rows[$z] = $rows[$z] ?? ['zone' => $z, 'first_500' => 0, 'add_500' => 0, 'base_kg' => $s['kind'] === 'b2b' ? 20 : 0.5, 'step_kg' => $s['kind'] === 'b2b' ? 1 : 0.5];
            $s['rates'][$ck] = array_values($rows);
        }
    }
    return $list;
}
route('GET', '/admin/services', function () {
    require_admin('rates');
    return ['items' => services_for_admin(), 'zones' => ZONE_LABEL, 'global_markup' => (float) setting('global_markup', 20), 'gst_pct' => (float) setting('gst_pct', 18), 'topay_fee' => (float) setting('topay_fee', 0)];
});
route('PUT', '/admin/services/([a-z0-9_]+)', function ($key) {
    require_admin('rates');
    $valid = array_column(services_for_admin(), null, 'key');
    if (!isset($valid[$key])) fail('Unknown service', 404);
    $p = (array) in('pricing', []);
    $mode = ($p['mode'] ?? 'api') === 'card' || !$valid[$key]['builtin'] ? 'card' : 'api';
    $mk = ($p['markup_pct'] ?? '') === '' || $p['markup_pct'] === null ? null : max(0, min(500, (float) $p['markup_pct']));
    q("INSERT INTO service_pricing (service_key, enabled, mode, markup_pct, first_mile, other_charges, other_label, min_kg, updated_at) VALUES (?,?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), mode=VALUES(mode), markup_pct=VALUES(markup_pct), first_mile=VALUES(first_mile), other_charges=VALUES(other_charges),
       other_label=VALUES(other_label), min_kg=VALUES(min_kg), updated_at=NOW()",
        [$key, !empty($p['enabled']) ? 1 : 0, $mode, $mk, max(0, (float) ($p['first_mile'] ?? 0)), max(0, (float) ($p['other_charges'] ?? 0)),
         mb_substr(trim((string) ($p['other_label'] ?? '')) ?: 'Other charges', 0, 60), max(0, (float) ($p['min_kg'] ?? 0))]);
    foreach ((array) in('rates', []) as $ck => $rows) {
        if (!isset($valid[$key]['cards'][$ck])) continue;
        foreach ((array) $rows as $r) {
            $z = strtoupper((string) ($r['zone'] ?? '')); if (!isset(ZONE_LABEL[$z])) continue;
            q("INSERT INTO rate_card (service, zone, first_500, add_500, base_kg, step_kg) VALUES (?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE first_500=VALUES(first_500), add_500=VALUES(add_500), base_kg=VALUES(base_kg), step_kg=VALUES(step_kg)",
                [$ck, $z, max(0, (float) $r['first_500']), max(0, (float) $r['add_500']), max(0.1, (float) ($r['base_kg'] ?? 0.5)), max(0.1, (float) ($r['step_kg'] ?? 0.5))]);
        }
    }
    if (!$valid[$key]['builtin'] && in('carrier_enabled') !== null) update('carriers', ['enabled' => in('carrier_enabled') ? 1 : 0, 'status' => in('carrier_enabled') ? 'live' : 'pending'], 'id=?', [$valid[$key]['carrier_id']]);
    if (in('topay_fee') !== null) set_setting('topay_fee', (string) max(0, (float) in('topay_fee')));
    return ['ok' => true];
});
// admin enters the real courier AWB for bookings made on a manually-managed carrier
route('PUT', '/admin/shipments/(\d+)/courier-awb', function ($id) {
    require_admin('shipments');
    $s = one("SELECT * FROM shipments WHERE id=?", [$id]); if (!$s) fail('Not found', 404);
    $awb = preg_replace('/[^A-Za-z0-9-]/', '', (string) req('awb'));
    if (strlen($awb) < 5) fail('Enter the courier AWB');
    if (val("SELECT id FROM shipments WHERE awb=? AND id<>?", [$awb, $id])) fail('This AWB is already used by another shipment');
    q("UPDATE wallet_txns SET ref=?, description=REPLACE(description, ?, ?) WHERE ref=?", [$awb, $s['awb'], $awb, $s['awb']]);
    update('shipments', ['awb' => $awb, 'courier_name' => in('courier_name') ?: $s['courier_name']], 'id=?', [$id]);
    add_event((int) $id, $s['status'], 'Courier AWB updated · ' . $awb, (string) (in('courier_name') ?: $s['courier_name']));
    return ['ok' => true, 'awb' => $awb];
});

// ---------- Integrations & API keys (payments, notifications) ----------
const INTEG_PLAIN = ['payment_gateway', 'razorpay_key_id', 'email_enabled', 'resend_from', 'email_reply_to', 'admin_alert_email', 'sms_enabled', 'way2sms_url', 'way2sms_sender_id', 'way2sms_usetype',
    'way2sms_dlt_entity_id', 'wa_enabled', 'wati_endpoint', 'site_url'];
const INTEG_SECRET = ['razorpay_key_secret', 'razorpay_webhook_secret', 'resend_api_key', 'way2sms_api_key', 'way2sms_secret', 'wati_token'];
route('GET', '/admin/integrations', function () {
    require_admin('content');
    $o = [];
    foreach (INTEG_PLAIN as $k) $o[$k] = setting($k, match ($k) { 'payment_gateway' => 'test', 'way2sms_url' => 'https://www.way2sms.com/api/v1/sendCampaign', 'way2sms_usetype' => 'prod', 'resend_from' => 'Vishwaship <noreply@vishwaship.com>', default => '' });
    foreach (INTEG_SECRET as $k) { $v = setting($k, ''); $o[$k . '_set'] = $v !== ''; $o[$k . '_hint'] = $v !== '' ? '••••' . substr($v, -4) : ''; }
    $o['events'] = notif_config(); $o['event_labels'] = NOTIFY_EVENTS; $o['buyer_events'] = BUYER_EVENTS;
    $base = rtrim(setting('site_url', ''), '/') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'vishwaship.com'));
    $o['razorpay_webhook_url'] = $base . '/api/payments/razorpay/webhook';
    return $o;
});
route('PUT', '/admin/integrations', function () {
    require_admin('content');
    foreach (INTEG_PLAIN as $k) if (in($k) !== null) { $v = in($k); set_setting($k, is_bool($v) ? ($v ? '1' : '0') : trim((string) $v)); }
    foreach (INTEG_SECRET as $k) { $v = in($k); if (is_string($v) && trim($v) !== '' && !str_contains($v, '••••')) set_setting($k, trim($v)); if (in($k . '_clear')) set_setting($k, ''); }
    if (in('events') !== null) {
        $ev = [];
        foreach ((array) in('events') as $k => $e) {
            if (!isset(NOTIFY_EVENTS[$k])) continue;
            $ev[$k] = ['email' => !empty($e['email']) ? 1 : 0, 'sms' => !empty($e['sms']) ? 1 : 0, 'wa' => !empty($e['wa']) ? 1 : 0,
                'subject' => mb_substr((string) ($e['subject'] ?? ''), 0, 150), 'text' => mb_substr((string) ($e['text'] ?? ''), 0, 600),
                'dlt_id' => preg_replace('/\D/', '', (string) ($e['dlt_id'] ?? '')), 'wa_template' => preg_replace('/[^a-z0-9_]/i', '', (string) ($e['wa_template'] ?? ''))];
        }
        set_setting('notif_events', json_encode($ev));
    }
    if (setting('payment_gateway') === 'razorpay' && (setting('razorpay_key_id') === '' || setting('razorpay_key_secret') === '')) set_setting('payment_gateway', 'test');
    set_setting('notif_provider_enabled', (setting('sms_enabled') === '1' || setting('wa_enabled') === '1') ? '1' : '0');
    set_setting('notif_provider_name', implode(' + ', array_filter([setting('wa_enabled') === '1' ? 'WATI WhatsApp' : '', setting('sms_enabled') === '1' ? 'Way2SMS' : ''])));
    return ['ok' => true];
});
route('POST', '/admin/integrations/test/(razorpay|email|sms|whatsapp)', function ($p) {
    $me = require_admin('content');
    $to = trim((string) in('to', ''));
    switch ($p) {
        case 'razorpay':
            if (setting('razorpay_key_id') === '' || setting('razorpay_key_secret') === '') fail('Enter Razorpay Key ID and Key Secret first');
            $r = razorpay_call('GET', '/orders?count=1');
            if (!is_array($r) || isset($r['error'])) fail('Razorpay rejected the keys: ' . ($r['error']['description'] ?? 'no response'));
            return ['ok' => true, 'message' => 'Razorpay keys are valid' . (str_starts_with(setting('razorpay_key_id'), 'rzp_test_') ? ' (TEST keys — use rzp_live_ keys to take real payments)' : ' (LIVE)')];
        case 'email':
            $r = send_email($to ?: (string) $me['email'], 'Vishwaship test email', "This is a test email from Vishwaship admin.\nResend is connected.");
            break;
        case 'sms':
            if (!$to) fail('Enter a mobile number');
            $c = notif_config()['booked'];
            $r = send_sms($to, notif_fill($c['text'], ['name' => 'Test', 'order_no' => 'VS-TEST', 'seller' => 'Vishwaship', 'courier' => 'Delhivery', 'awb' => 'TEST123', 'track_url' => 'https://vishwaship.com/track/']), (string) $c['dlt_id']);
            break;
        default:
            if (!$to) fail('Enter a WhatsApp number');
            $c = notif_config()['booked'];
            $r = send_whatsapp($to, (string) ($c['wa_template'] ?: in('template', '')), ['name' => 'Test', 'awb' => 'TEST123', 'order_no' => 'VS-TEST', 'courier' => 'Delhivery', 'seller' => 'Vishwaship', 'track_url' => 'https://vishwaship.com/track/']);
    }
    if (!$r['ok']) fail(ucfirst($p) . ' test failed: ' . $r['error']);
    return ['ok' => true, 'message' => ucfirst($p) . ' test sent'];
});
