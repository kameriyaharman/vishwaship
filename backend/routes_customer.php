<?php
// Customer portal routes (/me/*)

function month_range(?string $range): array {
    return match ($range) {
        'today' => [date('Y-m-d 00:00:00'), date('Y-m-d 23:59:59')],
        'week' => [date('Y-m-d 00:00:00', strtotime('-6 days')), date('Y-m-d 23:59:59')],
        'last_month' => [date('Y-m-01 00:00:00', strtotime('first day of last month')), date('Y-m-t 23:59:59', strtotime('last day of last month'))],
        'all' => ['2000-01-01', '2100-01-01'],
        default => [date('Y-m-01 00:00:00'), date('Y-m-t 23:59:59')],
    };
}

function status_counts(string $where, array $p): array {
    $rows = all("SELECT status, COUNT(*) n FROM shipments WHERE $where GROUP BY status", $p);
    $c = array_fill_keys(array_keys(STATUS_LABEL), 0);
    foreach ($rows as $r) $c[$r['status']] = (int)$r['n'];
    $c['all'] = array_sum($c);
    $c['rto'] = $c['rto_in_transit'] + $c['rto_delivered'];
    $c['weight_discrepancy'] = (int) val("SELECT COUNT(*) FROM shipments WHERE $where AND wd_open=1", $p);
    return $c;
}

function shipment_row(array $s): array {
    $s['status_label'] = $s['wd_open'] ? 'Weight discrepancy' : (STATUS_LABEL[$s['status']] ?? $s['status']);
    $s['status_key'] = $s['wd_open'] ? 'weight_discrepancy' : $s['status'];
    return $s;
}

function shipment_filters(array &$p, ?int $userId): string {
    $w = ['is_draft=0'];
    if ($userId) { $w[] = 's.user_id=?'; $p[] = $userId; }
    $tab = $_GET['tab'] ?? 'all';
    if ($tab === 'weight_discrepancy') $w[] = 's.wd_open=1';
    elseif ($tab === 'rto') $w[] = "s.status IN ('rto_in_transit','rto_delivered')";
    elseif ($tab && $tab !== 'all') { $w[] = 's.status=?'; $p[] = $tab; }
    if ($q = trim($_GET['q'] ?? '')) {
        $w[] = '(s.awb LIKE ? OR s.order_no LIKE ? OR s.to_name LIKE ? OR s.to_phone LIKE ? OR s.to_city LIKE ?)';
        array_push($p, "%$q%", "%$q%", "%$q%", "%$q%", "%$q%");
    }
    if (!empty($_GET['from'])) { $w[] = 's.created_at >= ?'; $p[] = $_GET['from'] . ' 00:00:00'; }
    if (!empty($_GET['to'])) { $w[] = 's.created_at <= ?'; $p[] = $_GET['to'] . ' 23:59:59'; }
    if (!empty($_GET['payment'])) { $w[] = 's.payment_mode=?'; $p[] = $_GET['payment']; }
    if (!empty($_GET['state'])) { $w[] = 's.to_state=?'; $p[] = $_GET['state']; }
    if (!empty($_GET['customer'])) { $w[] = 's.user_id=?'; $p[] = (int) $_GET['customer']; }
    return implode(' AND ', $w);
}

function my_shipment(int $id, array $u): array {
    $s = one("SELECT * FROM shipments WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$s) fail('Shipment not found', 404);
    return $s;
}

function shipment_detail(array $s, bool $admin = false): array {
    $s = shipment_row($s);
    $s['events'] = all("SELECT * FROM tracking_events WHERE shipment_id=? ORDER BY event_time DESC, id DESC", [$s['id']]);
    $s['dispute'] = one("SELECT * FROM weight_disputes WHERE shipment_id=? ORDER BY id DESC LIMIT 1", [$s['id']]);
    $s['customer'] = one("SELECT id,name,business_name,email,mobile,gstin,prefs FROM users WHERE id=?", [$s['user_id']]);
    $op = json_decode($s['customer']['prefs'] ?? '', true) ?: [];
    unset($s['customer']['prefs']);
    $s['label_prefs'] = (object) ($op['label'] ?? []);
    $s['invoice_prefs'] = (object) ($op['invoice'] ?? []);
    if (!$admin) { unset($s['base_rate'], $s['cod_base'], $s['markup_pct']); }
    return $s;
}

route('GET', '/me/dashboard', function () {
    $u = require_customer();
    sweep_disputes();
    [$a, $b] = month_range($_GET['range'] ?? 'month');
    $c = status_counts("user_id=? AND is_draft=0 AND created_at BETWEEN ? AND ?", [$u['id'], $a, $b]);
    $live = status_counts("user_id=? AND is_draft=0", [$u['id']]);
    $days = [];
    for ($i = 6; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $days[] = ['date' => $d, 'label' => date('D', strtotime($d)), 'n' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND is_draft=0 AND DATE(created_at)=?", [$u['id'], $d])];
    }
    $recent = array_map('shipment_row', all("SELECT * FROM shipments WHERE user_id=? AND is_draft=0 ORDER BY created_at DESC LIMIT 6", [$u['id']]));
    $wd = one("SELECT COUNT(*) n, COALESCE(SUM(customer_extra),0) amt FROM weight_disputes WHERE user_id=? AND status='open'", [$u['id']]);
    return [
        'range_counts' => $c, 'live' => $live,
        'delivered_pct' => $c['all'] ? round($c['delivered'] / $c['all'] * 100, 1) : 0,
        'rto_pct' => $c['all'] ? round($c['rto'] / $c['all'] * 100, 1) : 0,
        'pickup_today' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='pickup_pending' AND pickup_date=CURDATE()", [$u['id']]),
        'chart' => $days, 'recent' => $recent,
        'cod_pending' => (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE user_id=? AND cod_status IN ('pending','received')", [$u['id']]),
        'next_remittance' => setting('cod_next_remittance'),
        'wallet' => (float) $u['wallet_balance'],
        'spent_month' => (float) val("SELECT COALESCE(SUM(amount),0) FROM wallet_txns WHERE user_id=? AND type='debit' AND created_at >= ?", [$u['id'], date('Y-m-01')]),
        'wd_open' => (int) $wd['n'], 'wd_amount' => (float) $wd['amt'],
        'ndr_open' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='ndr' AND ndr_action IS NULL", [$u['id']]),
    ];
});

route('GET', '/me/notifications', function () {
    $u = require_customer();
    $n = [];
    $wd = (int) val("SELECT COUNT(*) FROM weight_disputes WHERE user_id=? AND status='open'", [$u['id']]);
    if ($wd) $n[] = ['text' => "$wd weight discrepancy to review", 'href' => '/weight-discrepancy'];
    $ndr = (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='ndr' AND ndr_action IS NULL", [$u['id']]);
    if ($ndr) $n[] = ['text' => "$ndr NDR shipment(s) need action", 'href' => '/ndr'];
    if ((float)$u['wallet_balance'] < (float) setting('low_wallet_threshold', 500)) $n[] = ['text' => 'Low wallet balance — recharge to keep booking', 'href' => '/wallet'];
    if ($u['kyc_status'] !== 'verified') $n[] = ['text' => 'Complete your KYC', 'href' => '/settings'];
    foreach (all("SELECT id, subject FROM tickets WHERE user_id=? AND reply IS NOT NULL AND status='open' LIMIT 3", [$u['id']]) as $t) $n[] = ['text' => 'Support replied: ' . $t['subject'], 'href' => '/settings'];
    return ['items' => $n];
});

// ---------- pickup addresses ----------
route('GET', '/me/pickups', function () { $u = require_customer(); return ['items' => all("SELECT * FROM pickup_addresses WHERE user_id=? ORDER BY is_default DESC, id", [$u['id']])]; });
function pickup_payload(): array {
    $pin = preg_replace('/\D/', '', (string) req('pincode'));
    if (strlen($pin) !== 6) fail('Enter valid pincode');
    return ['name' => trim((string) req('name')), 'contact' => trim((string) req('contact')), 'phone' => preg_replace('/\D/', '', (string) req('phone')),
        'address' => trim((string) req('address')), 'city' => trim((string) req('city')), 'state' => trim((string) req('state')), 'pincode' => $pin];
}
route('POST', '/me/pickups', function () {
    $u = require_customer();
    $d = pickup_payload() + ['user_id' => $u['id']];
    if (!val("SELECT id FROM pickup_addresses WHERE user_id=?", [$u['id']]) || in('is_default')) { q("UPDATE pickup_addresses SET is_default=0 WHERE user_id=?", [$u['id']]); $d['is_default'] = 1; }
    $id = insert('pickup_addresses', $d);
    delhivery_register_pickup(one("SELECT * FROM pickup_addresses WHERE id=?", [$id]));
    activity((int)$u['id'], 'Added warehouse', $d['name'] . ' · ' . $d['pincode']);
    return one("SELECT * FROM pickup_addresses WHERE id=?", [$id]);
});
route('PUT', '/me/pickups/(\d+)', function ($id) {
    $u = require_customer();
    if (!val("SELECT id FROM pickup_addresses WHERE id=? AND user_id=?", [$id, $u['id']])) fail('Not found', 404);
    if (in('is_default')) { q("UPDATE pickup_addresses SET is_default=0 WHERE user_id=?", [$u['id']]); update('pickup_addresses', ['is_default' => 1], 'id=?', [$id]); }
    if (in('name')) update('pickup_addresses', pickup_payload(), 'id=?', [$id]);
    return one("SELECT * FROM pickup_addresses WHERE id=?", [$id]);
});
route('DELETE', '/me/pickups/(\d+)', function ($id) { $u = require_customer(); q("DELETE FROM pickup_addresses WHERE id=? AND user_id=?", [$id, $u['id']]); return ['ok' => true]; });

// ---------- booking ----------
route('POST', '/me/quote', function () {
    $u = require_customer();
    $from = (string) req('from'); $to = (string) req('to');
    return quote($from, $to, (float) req('weight'), in('l', 0), in('b', 0), in('h', 0), in('payment', 'prepaid') === 'cod' ? 'cod' : 'prepaid', (float) in('cod_amount', 0), $u, (float) in('invoice_value', 0));
});

function book_shipment(array $u, array $in, bool $draft = false): array {
    $g = fn($k, $d = null) => $in[$k] ?? $d;
    if (setting('require_kyc', '0') === '1' && $u['kyc_status'] !== 'verified' && !$draft) fail('Please complete KYC before booking (Settings → KYC).');
    $p = one("SELECT * FROM pickup_addresses WHERE id=? AND user_id=?", [(int) $g('pickup_id'), $u['id']]);
    if (!$p) fail('Select a pickup address');
    foreach (['to_name' => 'Receiver name', 'to_phone' => 'Receiver mobile', 'to_pincode' => 'Delivery pincode', 'to_address' => 'Full address', 'weight' => 'Weight'] as $k => $lbl)
        if (!$draft && ($g($k) === null || $g($k) === '')) fail("$lbl is required");
    $to = preg_replace('/\D/', '', (string) $g('to_pincode', ''));
    $payment = $g('payment_mode', 'prepaid') === 'cod' ? 'cod' : 'prepaid';
    $invoice = (float) $g('invoice_value', 0);
    $cod = $payment === 'cod' ? (float) ($g('cod_amount') ?: $invoice) : 0;
    $w = (float) $g('weight', 0.5);
    $service = preg_replace('/[^a-z0-9_]/i', '', (string) $g('service', 'surface')) ?: 'surface';
    $data = [
        'user_id' => $u['id'], 'pickup_id' => $p['id'],
        'from_name' => $p['name'], 'from_contact' => $p['contact'], 'from_phone' => $p['phone'], 'from_address' => $p['address'], 'from_city' => $p['city'], 'from_state' => $p['state'], 'from_pincode' => $p['pincode'],
        'to_name' => trim((string) $g('to_name', '')), 'to_phone' => preg_replace('/\D/', '', (string) $g('to_phone', '')), 'to_address' => trim((string) $g('to_address', '')),
        'to_city' => $g('to_city'), 'to_state' => $g('to_state'), 'to_pincode' => $to,
        'product' => $g('product', ''), 'invoice_value' => $invoice, 'payment_mode' => $payment, 'cod_amount' => $cod,
        'weight' => $w, 'length' => (float) $g('length', 0), 'breadth' => (float) $g('breadth', 0), 'height' => (float) $g('height', 0),
        'pickup_date' => $g('pickup_date') ?: date('Y-m-d'), 'pickup_slot' => $g('pickup_slot') ?: '2 PM – 6 PM', 'service' => $service,
    ];
    if ($draft) {
        $data += ['order_no' => next_order_no(), 'is_draft' => 1, 'status' => 'draft'];
        $id = (int) $g('draft_id', 0);
        if ($id && val("SELECT id FROM shipments WHERE id=? AND user_id=? AND is_draft=1", [$id, $u['id']])) { unset($data['order_no']); update('shipments', $data, 'id=?', [$id]); }
        else $id = insert('shipments', $data);
        return ['draft_id' => $id];
    }
    if (strlen($to) !== 6) fail('Enter valid delivery pincode');
    $sv = delhivery_serviceability($to);
    if (!$sv['serviceable']) fail('Delivery pincode is not serviceable');
    if ($payment === 'cod' && !$sv['cod']) fail('COD is not available for this pincode');
    $qt = quote($p['pincode'], $to, $w, $data['length'], $data['breadth'], $data['height'], $payment, $cod, $u, $invoice);
    $opt = null; foreach ($qt['options'] as $o) if ($o['service'] === $service) $opt = $o;
    if (!$opt) fail('Selected service is not available');
    $available = (float) $u['wallet_balance'] + (float) $u['credit_limit'];
    if ($available < $opt['total']) fail('Insufficient wallet balance. Please recharge ₹' . number_format(ceil($opt['total'] - $available)) . ' or more.', 402);

    $data += ['order_no' => next_order_no(), 'vol_weight' => $qt['vol_weight'], 'chargeable_weight' => $qt['chargeable_weight'], 'zone' => $qt['zone'],
        'markup_pct' => $qt['markup'], 'base_rate' => $opt['base'], 'cod_base' => $opt['cod_base'], 'freight' => $opt['freight'], 'cod_charge' => $opt['cod_charge'],
        'gst' => $opt['gst'], 'total' => $opt['total'], 'status' => 'pickup_pending', 'eta' => $opt['eta'], 'is_draft' => 0,
        'provider' => $opt['provider'], 'courier_name' => $opt['name'], 'courier_id' => $opt['courier_id']];
    if ($opt['provider'] === 'shipmozo') {
        $res = shipmozo_create($data, (string) $opt['courier_id']);
        if (!$res['ok']) fail($res['error']);
        $data['provider_order_id'] = $res['order_id'];
    } else {
        $res = delhivery_create_shipment($data, $p['delhivery_name'] ?: $p['name']);
        if (!$res['ok']) fail('Delhivery: ' . $res['error']);
    }
    $data['awb'] = $res['awb'];
    db()->beginTransaction();
    $draftId = (int) $g('draft_id', 0);
    if ($draftId && val("SELECT id FROM shipments WHERE id=? AND user_id=? AND is_draft=1", [$draftId, $u['id']])) { unset($data['order_no']); update('shipments', $data, 'id=?', [$draftId]); $id = $draftId; }
    else $id = insert('shipments', $data);
    wallet_txn((int)$u['id'], 'debit', $opt['total'], 'Shipment ' . $res['awb'], $res['awb'], 'shipment');
    add_event($id, 'pickup_pending', 'Booked · AWB generated', 'vishwaship.com');
    db()->commit();
    if ($opt['provider'] === 'delhivery') delhivery_pickup_request($p['delhivery_name'] ?: $p['name'], $data['pickup_date'], 1);
    activity((int)$u['id'], 'Booked shipment', $res['awb'] . ' · ' . $data['to_city'] . ' ' . $to . ' · ₹' . $opt['total']);
    return one("SELECT * FROM shipments WHERE id=?", [$id]);
}

route('POST', '/me/shipments', function () { $u = require_customer(); return book_shipment($u, body(), (bool) in('draft')); });
route('GET', '/me/drafts', function () { $u = require_customer(); return ['items' => all("SELECT * FROM shipments WHERE user_id=? AND is_draft=1 ORDER BY id DESC", [$u['id']])]; });
route('DELETE', '/me/drafts/(\d+)', function ($id) { $u = require_customer(); q("DELETE FROM shipments WHERE id=? AND user_id=? AND is_draft=1", [$id, $u['id']]); return ['ok' => true]; });

route('GET', '/me/shipments', function () {
    $u = require_customer();
    $p = [];
    $where = shipment_filters($p, (int)$u['id']);
    if (!empty($_GET['export'])) {
        $rows = all("SELECT s.* FROM shipments s WHERE $where ORDER BY s.created_at DESC", $p);
        csv_out('shipments.csv', ['AWB', 'Order', 'Booked', 'From', 'To', 'Receiver', 'Phone', 'Weight', 'Chargeable', 'Mode', 'COD amount', 'Service', 'Freight', 'COD charge', 'GST', 'Total', 'Status'],
            array_map(fn($s) => [$s['awb'], $s['order_no'], $s['created_at'], $s['from_city'] . ' ' . $s['from_pincode'], $s['to_city'] . ' ' . $s['to_pincode'], $s['to_name'], $s['to_phone'],
                $s['weight'], $s['chargeable_weight'], $s['payment_mode'], $s['cod_amount'], $s['service'], $s['freight'], $s['cod_charge'], $s['gst'], $s['total'], shipment_row($s)['status_label']], $rows));
    }
    [$lim, $off] = paginate();
    $items = array_map('shipment_row', all("SELECT s.* FROM shipments s WHERE $where ORDER BY s.created_at DESC LIMIT $lim OFFSET $off", $p));
    return ['items' => $items, 'total' => (int) val("SELECT COUNT(*) FROM shipments s WHERE $where", $p),
        'counts' => status_counts('user_id=? AND is_draft=0', [$u['id']]),
        'states' => array_column(all("SELECT DISTINCT to_state FROM shipments WHERE user_id=? AND to_state IS NOT NULL ORDER BY to_state", [$u['id']]), 'to_state')];
});

route('GET', '/me/shipments/(\d+)', function ($id) { $u = require_customer(); return shipment_detail(my_shipment((int)$id, $u)); });

route('POST', '/me/shipments/(\d+)/cancel', function ($id) {
    $u = require_customer();
    $s = my_shipment((int)$id, $u);
    if ($s['status'] !== 'pickup_pending') fail('Only shipments not yet picked up can be cancelled');
    if (($s['provider'] ?? 'delhivery') === 'shipmozo') { if (!shipmozo_cancel($s)) fail('Shipmozo could not cancel this shipment. Please contact support.'); }
    else delhivery_cancel((string)$s['awb']);
    db()->beginTransaction();
    update('shipments', ['status' => 'cancelled'], 'id=?', [$id]);
    add_event((int)$id, 'cancelled', 'Shipment cancelled', '', 'Cancelled by customer');
    wallet_txn((int)$u['id'], 'credit', (float)$s['total'], 'Refund · cancelled ' . $s['awb'], $s['awb'], 'refund');
    db()->commit();
    activity((int)$u['id'], 'Cancelled shipment', (string)$s['awb']);
    return ['ok' => true];
});

route('POST', '/me/shipments/bulk', function () {
    $u = require_customer();
    $csv = (string) req('csv');
    $lines = array_values(array_filter(preg_split('/\r\n|\n|\r/', trim($csv))));
    if (count($lines) < 2) fail('CSV has no rows');
    $head = array_map(fn($h) => strtolower(trim($h)), str_getcsv(array_shift($lines)));
    $pickup = one("SELECT * FROM pickup_addresses WHERE user_id=? ORDER BY is_default DESC LIMIT 1", [$u['id']]);
    if (!$pickup) fail('Add a pickup address first');
    $ok = 0; $errors = [];
    foreach ($lines as $i => $line) {
        $row = @array_combine($head, array_pad(str_getcsv($line), count($head), ''));
        if (!$row) { $errors[] = 'Row ' . ($i + 2) . ': column count mismatch'; continue; }
        try {
            $u = one("SELECT * FROM users WHERE id=?", [$u['id']]);
            $info = pincode_info(preg_replace('/\D/', '', $row['to_pincode'] ?? ''));
            book_shipment($u, $row + ['pickup_id' => $pickup['id'], 'to_city' => $row['to_city'] ?? $info['city'], 'to_state' => $row['to_state'] ?? $info['state']]);
            $ok++;
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            $errors[] = 'Row ' . ($i + 2) . ': ' . $e->getMessage();
        }
    }
    return ['booked' => $ok, 'errors' => $errors];
});

route('POST', '/me/tickets', function () {
    $u = require_customer();
    insert('tickets', ['user_id' => $u['id'], 'shipment_id' => in('shipment_id') ?: null, 'subject' => req('subject'), 'message' => req('message')]);
    return ['ok' => true];
});
route('GET', '/me/tickets', function () { $u = require_customer(); return ['items' => all("SELECT * FROM tickets WHERE user_id=? ORDER BY id DESC", [$u['id']])]; });

// ---------- weight discrepancy ----------
route('GET', '/me/disputes', function () {
    $u = require_customer();
    sweep_disputes();
    $items = all("SELECT d.*, s.to_city, s.service FROM weight_disputes d JOIN shipments s ON s.id=d.shipment_id WHERE d.user_id=? ORDER BY FIELD(d.status,'open','disputed','accepted','resolved'), d.id DESC", [$u['id']]);
    foreach ($items as &$d) { unset($d['base_extra']); $d['time_left'] = $d['status'] === 'open' ? max(0, (int) ceil((strtotime($d['deadline']) - time()) / 86400)) : null; }
    return ['items' => $items, 'stats' => [
        'open' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE user_id=? AND status='open'", [$u['id']]),
        'open_amount' => (float) val("SELECT COALESCE(SUM(customer_extra),0) FROM weight_disputes WHERE user_id=? AND status='open'", [$u['id']]),
        'disputed' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE user_id=? AND status='disputed'", [$u['id']]),
        'resolved_month' => (int) val("SELECT COUNT(*) FROM weight_disputes WHERE user_id=? AND status IN ('accepted','resolved') AND resolved_at >= ?", [$u['id'], date('Y-m-01')]),
        'days' => (int) setting('auto_accept_days', 7),
    ]];
});
route('POST', '/me/disputes/(\d+)/accept', function ($id) {
    $u = require_customer();
    $d = one("SELECT * FROM weight_disputes WHERE id=? AND user_id=? AND status='open'", [$id, $u['id']]);
    if (!$d) fail('Discrepancy not open');
    accept_dispute($d);
    activity((int)$u['id'], 'Accepted weight discrepancy', (string)$d['awb']);
    return ['ok' => true];
});
route('POST', '/me/disputes/(\d+)/dispute', function ($id) {
    $u = require_customer();
    $d = one("SELECT * FROM weight_disputes WHERE id=? AND user_id=? AND status='open'", [$id, $u['id']]);
    if (!$d) fail('Discrepancy not open');
    $ids = array_filter(array_map('intval', (array) in('proof_ids', [])));
    update('weight_disputes', ['status' => 'disputed', 'customer_action' => $ids ? 'Disputed + photos' : 'Disputed', 'customer_note' => in('note', ''),
        'customer_proof_ids' => implode(',', $ids)], 'id=?', [$id]);
    activity((int)$u['id'], 'Raised weight dispute', (string)$d['awb']);
    return ['ok' => true];
});

// ---------- NDR / RTO ----------
route('GET', '/me/ndr', function () {
    $u = require_customer();
    $items = all("SELECT * FROM shipments WHERE user_id=? AND (status IN ('ndr','rto_in_transit') OR (status='rto_delivered' AND updated_at >= ?)) ORDER BY FIELD(status,'ndr','rto_in_transit','rto_delivered'), updated_at DESC", [$u['id'], date('Y-m-d', strtotime('-60 days'))]);
    $month = date('Y-m-01');
    $total = (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND is_draft=0 AND created_at >= ?", [$u['id'], date('Y-m-d', strtotime('-30 days'))]);
    $rto = (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status IN ('rto_in_transit','rto_delivered') AND created_at >= ?", [$u['id'], date('Y-m-d', strtotime('-30 days'))]);
    return ['items' => array_map('shipment_row', $items), 'stats' => [
        'ndr_pending' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='ndr' AND ndr_action IS NULL", [$u['id']]),
        'rto_transit' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='rto_in_transit'", [$u['id']]),
        'rto_delivered_month' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='rto_delivered' AND updated_at >= ?", [$u['id'], $month]),
        'rto_rate' => $total ? round($rto / $total * 100, 1) : 0,
    ]];
});
route('POST', '/me/ndr/(\d+)', function ($id) {
    $u = require_customer();
    $s = my_shipment((int)$id, $u);
    if ($s['status'] !== 'ndr') fail('Shipment is not in NDR');
    $act = (string) req('action');
    if ($act === 'reattempt') {
        delhivery_ndr((string)$s['awb'], 'RE-ATTEMPT');
        update('shipments', ['ndr_action' => 'Re-attempt requested' . (in('date') ? ' for ' . in('date') : '')], 'id=?', [$id]);
        add_event((int)$id, 'ndr', 'Re-attempt requested by seller', '', (string) in('remark', ''));
    } elseif ($act === 'change_address') {
        $upd = ['ndr_action' => 'Address updated', 'to_address' => trim((string) req('address'))];
        if (in('phone')) $upd['to_phone'] = preg_replace('/\D/', '', (string) in('phone'));
        update('shipments', $upd, 'id=?', [$id]);
        delhivery_ndr((string)$s['awb'], 'RE-ATTEMPT');
        add_event((int)$id, 'ndr', 'Address updated by seller — re-attempt', '', '');
    } elseif ($act === 'rto') {
        update('shipments', ['ndr_action' => 'RTO requested'], 'id=?', [$id]);
        apply_status($s, 'rto_in_transit', 'RTO requested by seller', '', '');
    } else fail('Unknown action');
    activity((int)$u['id'], 'NDR action: ' . $act, (string)$s['awb']);
    return ['ok' => true];
});

// ---------- wallet ----------
route('GET', '/me/wallet', function () {
    $u = require_customer();
    $m = date('Y-m-01');
    return [
        'balance' => (float) $u['wallet_balance'], 'credit_limit' => (float) $u['credit_limit'],
        'cod_pending' => (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE user_id=? AND cod_status IN ('pending','received')", [$u['id']]),
        'cod_remitted_month' => (float) val("SELECT COALESCE(SUM(amount),0) FROM cod_remittances WHERE user_id=? AND created_at >= ?", [$u['id'], $m]),
        'spent_month' => (float) val("SELECT COALESCE(SUM(amount),0) FROM wallet_txns WHERE user_id=? AND type='debit' AND created_at >= ?", [$u['id'], $m]),
        'shipments_month' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND is_draft=0 AND created_at >= ?", [$u['id'], $m]),
        'next_remittance' => setting('cod_next_remittance'), 'bank_last4' => substr((string) $u['bank_account'], -4), 'bank_name' => $u['bank_name'],
        'txns' => all("SELECT * FROM wallet_txns WHERE user_id=? ORDER BY id DESC LIMIT 200", [$u['id']]),
        'remittances' => all("SELECT * FROM cod_remittances WHERE user_id=? ORDER BY id DESC LIMIT 50", [$u['id']]),
        'invoices' => all("SELECT * FROM invoices WHERE user_id=? ORDER BY period DESC", [$u['id']]),
        'gateway' => setting('payment_gateway', 'test'), 'razorpay_key_id' => setting('razorpay_key_id', ''), 'min_recharge' => (float) setting('min_recharge', 500),
    ];
});

function razorpay_call(string $method, string $path, array $data = []) {
    $ch = curl_init('https://api.razorpay.com/v1' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => setting('razorpay_key_id') . ':' . setting('razorpay_key_secret'),
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $r = curl_exec($ch); curl_close($ch);
    return json_decode((string)$r, true);
}

route('POST', '/me/wallet/recharge', function () {
    $u = require_customer();
    $amt = round((float) req('amount'), 2);
    if ($amt < (float) setting('min_recharge', 500)) fail('Minimum recharge is ₹' . setting('min_recharge', 500));
    if ($amt > 500000) fail('Maximum recharge is ₹5,00,000');
    if (setting('payment_gateway') === 'razorpay' && setting('razorpay_key_id') && setting('razorpay_key_secret')) {
        $o = razorpay_call('POST', '/orders', ['amount' => (int) round($amt * 100), 'currency' => 'INR', 'receipt' => 'W' . $u['id'] . '-' . time()]);
        if (empty($o['id'])) fail('Payment gateway error. Try again.');
        return ['mode' => 'razorpay', 'order_id' => $o['id'], 'amount' => $amt, 'key' => setting('razorpay_key_id'), 'name' => $u['business_name'] ?: $u['name'], 'email' => $u['email'], 'contact' => $u['mobile']];
    }
    db()->beginTransaction();
    $bal = wallet_txn((int)$u['id'], 'credit', $amt, 'Wallet recharge · UPI (test mode)', 'TEST' . time(), 'recharge');
    db()->commit();
    activity((int)$u['id'], 'Recharged wallet', '₹' . $amt);
    return ['mode' => 'test', 'balance' => $bal];
});
route('POST', '/me/wallet/verify', function () {
    $u = require_customer();
    $oid = (string) req('razorpay_order_id'); $pid = (string) req('razorpay_payment_id'); $sig = (string) req('razorpay_signature');
    if (!hash_equals(hash_hmac('sha256', "$oid|$pid", setting('razorpay_key_secret')), $sig)) fail('Payment verification failed');
    if (val("SELECT id FROM wallet_txns WHERE ref=?", [$pid])) return ['ok' => true];
    $o = razorpay_call('GET', '/orders/' . $oid);
    $amt = ((int) ($o['amount_paid'] ?? 0)) / 100;
    if ($amt <= 0) fail('Payment not captured yet');
    db()->beginTransaction();
    $bal = wallet_txn((int)$u['id'], 'credit', $amt, 'Wallet recharge · Razorpay', $pid, 'recharge');
    db()->commit();
    return ['ok' => true, 'balance' => $bal];
});

function invoice_detail(array $inv): array {
    [$y, $m] = explode('-', $inv['period']);
    $from = "$y-$m-01 00:00:00"; $to = date('Y-m-t 23:59:59', strtotime($from));
    $inv['customer'] = one("SELECT name,business_name,email,mobile,gstin,city FROM users WHERE id=?", [$inv['user_id']]);
    $inv['lines'] = all("SELECT awb, order_no, created_at, to_city, to_pincode, chargeable_weight, service, freight, cod_charge, gst, total FROM shipments WHERE user_id=? AND is_draft=0 AND status<>'cancelled' AND created_at BETWEEN ? AND ? ORDER BY created_at", [$inv['user_id'], $from, $to]);
    $inv['company'] = ['name' => setting('company_name'), 'gstin' => setting('company_gstin'), 'address' => setting('company_address'), 'gst_pct' => setting('gst_pct')];
    return $inv;
}
route('GET', '/me/invoices/(\d+)', function ($id) {
    $u = require_customer();
    $inv = one("SELECT * FROM invoices WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$inv) fail('Not found', 404);
    return invoice_detail($inv);
});

// ---------- profile / KYC ----------
route('PUT', '/me/profile', function () {
    $u = require_customer();
    $allowed = ['name', 'business_name', 'mobile', 'city', 'gstin', 'bank_name', 'bank_account', 'bank_ifsc', 'monthly_volume', 'address', 'state', 'pincode'];
    $d = [];
    foreach ($allowed as $k) if (array_key_exists($k, body())) $d[$k] = trim((string) body()[$k]) ?: null;
    if (isset($d['name']) && !$d['name']) fail('Name is required');
    update('users', $d, 'id=?', [$u['id']]);
    activity((int)$u['id'], 'Updated profile');
    return public_user(one("SELECT * FROM users WHERE id=?", [$u['id']]));
});
route('POST', '/me/kyc', function () {
    $u = require_customer();
    $type = strtoupper((string) req('type'));
    if (!in_array($type, ['GST', 'PAN', 'AADHAAR'])) fail('Choose GST, PAN or Aadhaar');
    $num = strtoupper(trim((string) req('number')));
    $d = ['kyc_type' => $type, 'kyc_status' => 'submitted', 'kyc_doc_id' => in('doc_id') ?: null, 'kyc_note' => null];
    if ($type === 'GST') { if (!preg_match('/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/', $num)) fail('Invalid GSTIN format'); $d['gstin'] = $num; }
    if ($type === 'PAN') { if (!preg_match('/^[A-Z]{5}\d{4}[A-Z]$/', $num)) fail('Invalid PAN format'); $d['pan'] = $num; }
    activity((int)$u['id'], 'Submitted KYC', $type);
    if ($type === 'AADHAAR') { if (!preg_match('/^\d{12}$/', preg_replace('/\s/', '', $num))) fail('Invalid Aadhaar number'); $d['aadhaar'] = 'XXXX XXXX ' . substr(preg_replace('/\s/', '', $num), -4); }
    update('users', $d, 'id=?', [$u['id']]);
    return public_user(one("SELECT * FROM users WHERE id=?", [$u['id']]));
});
