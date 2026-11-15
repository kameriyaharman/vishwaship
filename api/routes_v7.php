<?php
// Change requests (14 Nov 2026): uploads, KYC documents, order-status dashboard, shipping charges,
// COD remittance detail, support ticket conversations.

// ---------- uploads: images ≤ 2 MB; documents / audio / video ≤ 5 MB ----------
const UPLOAD_TYPES = [
    'image' => ['#^image/(png|jpe?g|webp|gif|heic)$#', 2],
    'doc' => ['#^(application/pdf|application/msword|application/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application/vnd\.ms-excel|text/plain|text/csv)$#', 5],
    'audio' => ['#^audio/(mpeg|mp3|mp4|ogg|wav|x-wav|webm|aac|x-m4a|m4a)$#', 5],
    'video' => ['#^video/(mp4|quicktime|webm|3gpp|x-matroska)$#', 5],
];
function store_upload(?int $userId, string $data, string $mime, string $name): int {
    if (str_contains($data, ',')) $data = explode(',', $data, 2)[1];
    $bin = base64_decode($data, true);
    if ($bin === false || $bin === '') fail('Invalid file');
    foreach (UPLOAD_TYPES as $kind => [$re, $mb]) {
        if (preg_match($re, $mime)) {
            if (strlen($bin) > $mb * 1024 * 1024) fail(ucfirst($kind === 'doc' ? 'Document' : $kind) . " must be under $mb MB");
            return insert('files', ['user_id' => $userId, 'name' => mb_substr($name, 0, 150), 'mime' => $mime, 'data' => $bin]);
        }
    }
    fail('This file type is not allowed. Use an image, PDF/Word/Excel document, audio or video.');
}
route('POST', '/files', function () {
    $u = require_user();
    return ['id' => store_upload((int)$u['id'], (string) req('data'), (string) in('mime', ''), (string) in('name', 'file'))];
});

// ---------- KYC with documents ----------
route('POST', '/me/kyc', function () {
    $u = require_customer();
    $b = body();
    $type = ($b['account_type'] ?? 'individual') === 'company' ? 'company' : 'individual';
    $aad = preg_replace('/\D/', '', (string) ($b['aadhaar'] ?? ''));
    $pan = strtoupper(trim((string) ($b['pan'] ?? '')));
    if (strlen($aad) !== 12) fail('Enter your 12-digit Aadhaar number');
    if (!preg_match('/^[A-Z]{5}\d{4}[A-Z]$/', $pan)) fail('Enter a valid PAN (e.g. ABCDE1234F)');
    $own = fn($id) => $id && val("SELECT id FROM files WHERE id=? AND user_id=?", [(int)$id, $u['id']]) ? (int)$id : null;
    $docs = ['aadhaar_doc_id' => $own($b['aadhaar_doc_id'] ?? null), 'pan_doc_id' => $own($b['pan_doc_id'] ?? null), 'cheque_doc_id' => $own($b['cheque_doc_id'] ?? null)];
    if (!$docs['aadhaar_doc_id']) fail('Upload your Aadhaar card');
    if (!$docs['pan_doc_id']) fail('Upload your PAN card');
    if (!$docs['cheque_doc_id']) fail('Upload a cancelled cheque');
    foreach (['bank_name' => 'Bank name', 'bank_account' => 'Account number', 'bank_ifsc' => 'IFSC'] as $k => $l) if (trim((string) ($b[$k] ?? '')) === '') fail("$l is required");
    $ifsc = strtoupper(trim((string) $b['bank_ifsc']));
    if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $ifsc)) fail('Enter a valid IFSC code (e.g. HDFC0001234)');
    $acct = preg_replace('/\s/', '', (string) $b['bank_account']);
    if (!preg_match('/^\d{6,20}$/', $acct)) fail('Enter a valid bank account number');
    $gst = strtoupper(trim((string) ($b['gstin'] ?? '')));
    if ($gst && !preg_match('/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/', $gst)) fail('Invalid GSTIN format');
    $d = $docs + ['account_type' => $type, 'aadhaar' => 'XXXX XXXX ' . substr($aad, -4), 'pan' => $pan, 'bank_name' => trim((string) $b['bank_name']), 'bank_account' => $acct,
        'bank_ifsc' => $ifsc, 'gst_doc_id' => $type === 'company' ? $own($b['gst_doc_id'] ?? null) : null, 'kyc_type' => $type === 'company' ? 'Company' : 'Individual',
        'kyc_status' => 'submitted', 'kyc_note' => null, 'kyc_submitted_at' => date('Y-m-d H:i:s')];
    if ($gst) $d['gstin'] = $gst;
    if ($type === 'company' && !empty($b['business_name'])) $d['business_name'] = trim((string) $b['business_name']);
    update('users', $d, 'id=?', [$u['id']]);
    activity((int)$u['id'], 'Submitted KYC', $type);
    return public_user(one("SELECT * FROM users WHERE id=?", [$u['id']]));
});

// ---------- dashboard: order status (last 30 days) + revenue ----------
route('GET', '/me/dashboard/status', function () {
    $u = require_customer();
    $uid = $u['id']; $from30 = date('Y-m-d 00:00:00', strtotime('-29 days'));
    $c = one("SELECT COUNT(*) total, SUM(status='pickup_pending') pickup_pending, SUM(status IN ('picked_up','in_transit','out_for_delivery')) in_transit,
        SUM(status='delivered') delivered, SUM(status='ndr') undelivered, SUM(status IN ('rto_in_transit','rto_delivered')) rto, SUM(status='lost') lost
        FROM shipments WHERE user_id=? AND is_draft=0 AND status<>'cancelled' AND created_at >= ?", [$uid, $from30]);
    $rev = fn($from) => (float) val("SELECT COALESCE(SUM(invoice_value),0) FROM shipments WHERE user_id=? AND is_draft=0 AND status<>'cancelled' AND created_at >= ?", [$uid, $from]);
    $today = one("SELECT COUNT(*) n, COALESCE(SUM(invoice_value),0) v, SUM(payment_mode='cod') cod, SUM(payment_mode='prepaid') prepaid FROM shipments WHERE user_id=? AND is_draft=0 AND status<>'cancelled' AND DATE(created_at)=CURDATE()", [$uid]);
    return [
        'from' => substr($from30, 0, 10), 'to' => date('Y-m-d'),
        'today' => ['orders' => (int)$today['n'], 'value' => (float)$today['v'], 'cod' => (int)$today['cod'], 'prepaid' => (int)$today['prepaid'],
            'pickup_pending' => (int) val("SELECT COUNT(*) FROM shipments WHERE user_id=? AND status='pickup_pending' AND DATE(created_at)=CURDATE()", [$uid])],
        'counts' => array_map('intval', $c),
        'revenue' => ['today' => $rev(date('Y-m-d 00:00:00')), 'week' => $rev(date('Y-m-d 00:00:00', strtotime('monday this week'))), 'month' => $rev(date('Y-m-01 00:00:00')),
            'days90' => $rev(date('Y-m-d 00:00:00', strtotime('-89 days'))), 'year' => $rev(date('Y-01-01 00:00:00'))],
        'cod_due' => (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE user_id=? AND cod_status IN ('pending','received')", [$uid]),
        'next_remittance' => setting('cod_next_remittance'),
    ];
});

// ---------- shipping charges (entered vs courier weight) ----------
route('GET', '/me/shipping-charges', function () {
    $u = require_customer();
    [$from, $to, $a, $b] = date_range_params();
    $w = 's.user_id=? AND s.is_draft=0 AND s.created_at BETWEEN ? AND ?'; $p = [$u['id'], $a, $b];
    foreach (['order' => 's.order_no', 'awb' => 's.awb', 'order_ref' => 's.order_ref'] as $k => $col) if (trim($_GET[$k] ?? '') !== '') { $w .= " AND $col LIKE ?"; $p[] = '%' . trim($_GET[$k]) . '%'; }
    $rows = all("SELECT s.*, d.courier_dims d_dims, d.courier_vol d_vol, d.charged_weight d_charged, d.customer_extra d_extra, d.charged_amount d_charged_amt, d.status d_status
        FROM shipments s LEFT JOIN weight_disputes d ON d.id=(SELECT MAX(id) FROM weight_disputes WHERE shipment_id=s.id) WHERE $w ORDER BY s.created_at DESC LIMIT 2000", $p);
    $gstPct = (float) setting('gst_pct', 18);
    $items = array_map(function ($s) use ($gstPct) {
        $entered = (float)$s['freight'] + (float)$s['cod_charge'];
        $extra = (float)($s['d_extra'] ?? 0);
        $courier = $s['courier_weight'] !== null || $s['d_charged'] ? $entered + $extra : null;
        return [
            'id' => $s['id'], 'created_at' => $s['created_at'], 'order_no' => $s['order_no'], 'order_ref' => $s['order_ref'], 'type' => 'Forward', 'courier' => $s['courier_name'] ?: 'Delhivery ' . ucfirst($s['service']),
            'awb' => $s['awb'], 'status' => STATUS_LABEL[$s['status']] ?? $s['status'], 'invoice_value' => (float)$s['invoice_value'], 'payment_mode' => $s['payment_mode'], 'cod_amount' => (float)$s['cod_amount'],
            'entered' => ['weight' => (float)$s['weight'], 'dims' => (float)$s['length'] . '×' . (float)$s['breadth'] . '×' . (float)$s['height'], 'vol' => (float)$s['vol_weight'], 'charged' => (float)$s['chargeable_weight']],
            'courier_w' => ['weight' => $s['courier_weight'] !== null ? (float)$s['courier_weight'] : null, 'dims' => $s['d_dims'] ?: $s['courier_dims'], 'vol' => $s['d_vol'] !== null ? (float)$s['d_vol'] : null, 'charged' => $s['d_charged'] !== null ? (float)$s['d_charged'] : ($s['courier_weight'] !== null ? (float)$s['chargeable_weight'] : null)],
            'entered_charges' => round($entered, 2), 'courier_charges' => $courier !== null ? round($courier, 2) : null,
            'breakdown' => ['freight' => (float)$s['freight'], 'cod_charge' => (float)$s['cod_charge'], 'gst' => (float)$s['gst'], 'gst_pct' => $gstPct, 'total' => (float)$s['total'],
                'weight_extra' => $extra, 'weight_extra_status' => $s['d_status'], 'weight_extra_charged' => (float)($s['d_charged_amt'] ?? 0), 'rto_charge' => (float)$s['rto_charge'],
                'grand_total' => round((float)$s['total'] + (float)$s['rto_charge'] + (float)($s['d_charged_amt'] ?? 0), 2)],
        ];
    }, $rows);
    if (!empty($_GET['export'])) csv_out("shipping-charges-$from-to-$to.csv",
        ['Order date', 'Order ID', 'Order ref', 'Type', 'Courier', 'AWB', 'Status', 'Invoice value', 'Payment', 'COD amount', 'Entered weight', 'Entered dims', 'Entered vol. wt', 'Courier weight', 'Courier dims', 'Courier vol. wt', 'Entered weight charges', 'Courier weight charges', 'GST', 'RTO', 'Grand total'],
        array_map(fn($r) => [$r['created_at'], $r['order_no'], $r['order_ref'], $r['type'], $r['courier'], $r['awb'], $r['status'], $r['invoice_value'], $r['payment_mode'], $r['cod_amount'],
            $r['entered']['weight'], $r['entered']['dims'], $r['entered']['vol'], $r['courier_w']['weight'], $r['courier_w']['dims'], $r['courier_w']['vol'], $r['entered_charges'], $r['courier_charges'],
            $r['breakdown']['gst'], $r['breakdown']['rto_charge'], $r['breakdown']['grand_total']], $items));
    return ['items' => $items, 'from' => $from, 'to' => $to, 'total' => round(array_sum(array_map(fn($r) => $r['breakdown']['grand_total'], $items)), 2)];
});

// ---------- COD remittance ----------
route('GET', '/me/cod-remittances', function () {
    $u = require_customer();
    [$from, $to, $a, $b] = date_range_params();
    $w = 'user_id=? AND created_at BETWEEN ? AND ?'; $p = [$u['id'], $a, $b];
    if (trim($_GET['ref'] ?? '') !== '') { $w .= ' AND ref_no LIKE ?'; $p[] = '%' . trim($_GET['ref']) . '%'; }
    if (trim($_GET['utr'] ?? '') !== '') { $w .= ' AND utr LIKE ?'; $p[] = '%' . trim($_GET['utr']) . '%'; }
    $rows = all("SELECT * FROM cod_remittances WHERE $w ORDER BY id DESC", $p);
    $items = array_map(fn($r) => ['id' => $r['id'], 'generated_at' => $r['created_at'], 'ref_no' => $r['ref_no'] ?: 'CODR' . str_pad((string)$r['id'], 6, '0', STR_PAD_LEFT),
        'generated' => (float)($r['gross'] ?? $r['amount']), 'ecod' => (float)$r['fee'], 'wallet_used' => (float)$r['wallet_used'], 'net' => (float)$r['amount'],
        'paid' => (float)($r['amount_paid'] ?? 0), 'paid_at' => $r['paid_at'], 'utr' => $r['utr'] === 'WALLET' ? null : $r['utr'], 'orders' => (int)$r['shipments'],
        'status' => $r['status'] === 'paid' ? ((float)$r['wallet_used'] > 0 && (float)($r['amount_paid'] ?? 0) == 0 ? 'Adjusted to wallet' : 'Paid') : 'Pending'], $rows);
    if (!empty($_GET['export'])) csv_out("cod-remittance-$from-to-$to.csv", ['Generated date', 'Reference ID', 'Generated COD', 'ECOD charge', 'Wallet used', 'Net COD', 'Amount paid', 'Payment date', 'Bank transaction ID', 'Orders', 'Status'],
        array_map(fn($r) => [$r['generated_at'], $r['ref_no'], $r['generated'], $r['ecod'], $r['wallet_used'], $r['net'], $r['paid'], $r['paid_at'], $r['utr'], $r['orders'], $r['status']], $items));
    $all = one("SELECT COALESCE(SUM(COALESCE(gross,amount)),0) g, COALESCE(SUM(COALESCE(amount_paid,0)+wallet_used),0) p FROM cod_remittances WHERE user_id=?", [$u['id']]);
    $due = (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE user_id=? AND cod_status IN ('pending','received')", [$u['id']]);
    $ready = (float) val("SELECT COALESCE(SUM(cod_amount),0) FROM shipments WHERE user_id=? AND cod_status='received'", [$u['id']]);
    $feePct = $u['early_cod'] ? (float) setting('early_cod_fee_pct', 1) : 0;
    return ['items' => $items, 'from' => $from, 'to' => $to, 'summary' => [
        'total_generated' => round((float)$all['g'] + $due, 2), 'total_paid' => round((float)$all['p'], 2), 'total_due' => round($due, 2),
        'next_date' => setting('cod_next_remittance'), 'next_amount' => round(($ready ?: $due) * (1 - $feePct / 100), 2)]];
});
route('GET', '/me/cod-remittances/(\d+)/orders', function ($id) {
    $u = require_customer();
    $r = one("SELECT * FROM cod_remittances WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$r) fail('Not found', 404);
    $rows = all("SELECT order_no, order_ref, awb, created_at, delivered_at, to_name, to_city, to_pincode, cod_amount FROM shipments WHERE remittance_id=? AND user_id=? ORDER BY delivered_at", [$id, $u['id']]);
    csv_out(($r['ref_no'] ?: 'CODR' . $id) . '-orders.csv', ['Order ID', 'Order ref', 'AWB', 'Booked', 'Delivered', 'Receiver', 'City', 'Pincode', 'COD amount'], $rows);
});

// ---------- Support tickets ----------
const TICKET_CATEGORIES = ['Shipment Related Issue', 'Pickup Related Issue', 'Tech Related Issue', 'Billing & Remittance', 'Reattempt Shipment', 'Return Shipment',
    'Edit Order Information', 'Proof of Delivery', 'Recharge Issue', 'Lost / Damage / Wrong', 'Panel / Account Related'];
const TICKET_SHIPMENT_CATS = ['Shipment Related Issue', 'Pickup Related Issue', 'Reattempt Shipment', 'Return Shipment', 'Edit Order Information', 'Proof of Delivery', 'Lost / Damage / Wrong'];
const TICKET_STATUSES = ['open' => 'Open', 'in_progress' => 'In Progress', 'awaiting_customer' => 'Awaiting Customer', 'resolved' => 'Resolved', 'closed' => 'Closed'];

function ticket_files(string $ids, ?int $uid): string {
    $ok = [];
    foreach (array_slice(array_filter(array_map('intval', explode(',', $ids))), 0, 10) as $f)
        if ($uid === null ? val("SELECT id FROM files WHERE id=?", [$f]) : val("SELECT id FROM files WHERE id=? AND user_id=?", [$f, $uid])) $ok[] = $f;
    return implode(',', $ok);
}
function ticket_full(array $t): array {
    $t['status_label'] = TICKET_STATUSES[$t['status']] ?? $t['status'];
    $t['messages'] = all("SELECT m.*, u.name author_name FROM ticket_messages m LEFT JOIN users u ON u.id=m.author_id WHERE m.ticket_id=? ORDER BY m.id", [$t['id']]);
    foreach ($t['messages'] as &$m) $m['files'] = $m['file_ids'] ? all("SELECT id, name, mime FROM files WHERE id IN (" . implode(',', array_map('intval', explode(',', $m['file_ids']))) . ")") : [];
    $t['shipment'] = $t['shipment_id'] ? one("SELECT id, awb, order_no, status, to_name, to_city, to_pincode, created_at FROM shipments WHERE id=?", [$t['shipment_id']]) : null;
    return $t;
}
function ticket_event(int $tid, string $text, ?int $by = null): void {
    insert('ticket_messages', ['ticket_id' => $tid, 'author_type' => 'system', 'author_id' => $by, 'message' => $text, 'kind' => 'event']);
}

route('GET', '/me/tickets/meta', fn() => ['categories' => TICKET_CATEGORIES, 'shipment_categories' => TICKET_SHIPMENT_CATS, 'statuses' => TICKET_STATUSES]);
route('POST', '/me/tickets', function () {
    $u = require_customer();
    $cat = (string) req('category');
    if (!in_array($cat, TICKET_CATEGORIES)) fail('Select a category');
    $msg = trim((string) req('comment'));
    if (mb_strlen($msg) > 500) fail('Comment can be at most 500 characters');
    $ref = trim((string) in('reference', ''));
    $sid = null;
    if ($ref !== '') {
        $s = one("SELECT id, awb FROM shipments WHERE user_id=? AND (awb=? OR order_no=? OR order_ref=?) ORDER BY id DESC LIMIT 1", [$u['id'], $ref, $ref, $ref]);
        if (!$s) fail('No shipment found with this Order ID / AWB in your account');
        $sid = (int)$s['id']; $ref = (string)$s['awb'];
    } elseif (in_array($cat, TICKET_SHIPMENT_CATS)) fail('Order ID or AWB is required for this category');
    db()->beginTransaction();
    $id = insert('tickets', ['user_id' => $u['id'], 'shipment_id' => $sid, 'awb' => $ref ?: null, 'category' => $cat, 'subject' => $cat . ($ref ? " · $ref" : ''), 'message' => $msg,
        'status' => 'open', 'updated_at' => date('Y-m-d H:i:s'), 'customer_seen_at' => date('Y-m-d H:i:s'), 'last_reply_by' => 'customer']);
    $no = 'TKT' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    update('tickets', ['ticket_no' => $no], 'id=?', [$id]);
    insert('ticket_messages', ['ticket_id' => $id, 'author_type' => 'customer', 'author_id' => $u['id'], 'message' => $msg, 'file_ids' => ticket_files((string) in('file_ids', ''), (int)$u['id']) ?: null]);
    db()->commit();
    activity((int)$u['id'], 'Raised ticket', "$no · $cat");
    return ['id' => $id, 'ticket_no' => $no];
});
route('GET', '/me/tickets', function () {
    $u = require_customer();
    $w = 't.user_id=?'; $p = [$u['id']];
    if (!empty($_GET['status'])) { $w .= ' AND t.status=?'; $p[] = $_GET['status']; }
    if (trim($_GET['q'] ?? '') !== '') { $w .= ' AND (t.ticket_no LIKE ? OR t.awb LIKE ?)'; $q = '%' . trim($_GET['q']) . '%'; array_push($p, $q, $q); }
    $items = all("SELECT t.id, t.ticket_no, t.category, t.awb, t.shipment_id, t.status, t.created_at, t.updated_at, t.last_reply_by, t.customer_seen_at FROM tickets t WHERE $w ORDER BY COALESCE(t.updated_at, t.created_at) DESC LIMIT 300", $p);
    foreach ($items as &$t) { $t['status_label'] = TICKET_STATUSES[$t['status']] ?? $t['status']; $t['unread'] = $t['last_reply_by'] === 'staff' && !$t['customer_seen_at']; }
    return ['items' => $items, 'statuses' => TICKET_STATUSES];
});
route('GET', '/me/tickets/(\d+)', function ($id) {
    $u = require_customer();
    $t = one("SELECT * FROM tickets WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$t) fail('Ticket not found', 404);
    q("UPDATE tickets SET customer_seen_at=NOW() WHERE id=?", [$id]);
    return ticket_full($t);
});
route('POST', '/me/tickets/(\d+)/reply', function ($id) {
    $u = require_customer();
    $t = one("SELECT * FROM tickets WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$t) fail('Ticket not found', 404);
    if ($t['status'] === 'closed') fail('This ticket is closed. Raise a new ticket if you still need help.');
    $msg = trim((string) in('message', ''));
    $files = ticket_files((string) in('file_ids', ''), (int)$u['id']);
    if ($msg === '' && $files === '') fail('Write a message or attach a file');
    if (mb_strlen($msg) > 2000) fail('Message is too long');
    insert('ticket_messages', ['ticket_id' => $id, 'author_type' => 'customer', 'author_id' => $u['id'], 'message' => $msg, 'file_ids' => $files ?: null]);
    $st = in_array($t['status'], ['awaiting_customer']) ? 'in_progress' : $t['status'];
    update('tickets', ['status' => $st, 'updated_at' => date('Y-m-d H:i:s'), 'customer_seen_at' => date('Y-m-d H:i:s'), 'last_reply_by' => 'customer'], 'id=?', [$id]);
    return ticket_full(one("SELECT * FROM tickets WHERE id=?", [$id]));
});
route('POST', '/me/tickets/(\d+)/reopen', function ($id) {
    $u = require_customer();
    $t = one("SELECT * FROM tickets WHERE id=? AND user_id=?", [$id, $u['id']]);
    if (!$t || $t['status'] !== 'resolved') fail('Only resolved tickets can be reopened');
    update('tickets', ['status' => 'open', 'updated_at' => date('Y-m-d H:i:s'), 'last_reply_by' => 'customer'], 'id=?', [$id]);
    ticket_event((int)$id, 'Reopened by customer' . (trim((string) in('reason', '')) ? ': ' . mb_substr((string) in('reason'), 0, 300) : ''), (int)$u['id']);
    return ticket_full(one("SELECT * FROM tickets WHERE id=?", [$id]));
});

// admin
route('GET', '/admin/tickets', function () {
    require_admin('support');
    $w = '1=1'; $p = [];
    foreach (['status' => 't.status', 'category' => 't.category', 'priority' => 't.priority'] as $k => $col) if (!empty($_GET[$k])) { $w .= " AND $col=?"; $p[] = $_GET[$k]; }
    if (($_GET['assignee'] ?? '') === 'none') $w .= ' AND t.assignee_id IS NULL';
    elseif (!empty($_GET['assignee'])) { $w .= ' AND t.assignee_id=?'; $p[] = (int)$_GET['assignee']; }
    if (trim($_GET['q'] ?? '') !== '') { $w .= ' AND (t.ticket_no LIKE ? OR t.awb LIKE ? OR u.business_name LIKE ? OR u.name LIKE ?)'; $q = '%' . trim($_GET['q']) . '%'; array_push($p, $q, $q, $q, $q); }
    $items = all("SELECT t.id, t.ticket_no, t.category, t.awb, t.status, t.priority, t.assignee_id, t.created_at, t.updated_at, t.last_reply_by, COALESCE(u.business_name,u.name) customer, a.name assignee
        FROM tickets t JOIN users u ON u.id=t.user_id LEFT JOIN users a ON a.id=t.assignee_id WHERE $w
        ORDER BY FIELD(t.status,'open','in_progress','awaiting_customer','resolved','closed'), FIELD(t.priority,'urgent','high','normal','low'), COALESCE(t.updated_at,t.created_at) DESC LIMIT 500", $p);
    foreach ($items as &$t) $t['status_label'] = TICKET_STATUSES[$t['status']] ?? $t['status'];
    return ['items' => $items, 'statuses' => TICKET_STATUSES, 'categories' => TICKET_CATEGORIES,
        'staff' => all("SELECT id, name FROM users WHERE role IN ('admin','staff') AND status='active' ORDER BY name"),
        'counts' => array_column(all("SELECT status, COUNT(*) n FROM tickets GROUP BY status"), 'n', 'status')];
});
route('GET', '/admin/tickets/(\d+)', function ($id) {
    require_admin('support');
    $t = one("SELECT t.*, COALESCE(u.business_name,u.name) customer, u.email customer_email, u.mobile customer_mobile FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?", [$id]);
    if (!$t) fail('Not found', 404);
    return ticket_full($t) + ['staff' => all("SELECT id, name FROM users WHERE role IN ('admin','staff') AND status='active' ORDER BY name"), 'statuses' => TICKET_STATUSES];
});
route('POST', '/admin/tickets/(\d+)', function ($id) {
    $me = require_admin('support');
    $t = one("SELECT * FROM tickets WHERE id=?", [$id]);
    if (!$t) fail('Not found', 404);
    $upd = []; $now = date('Y-m-d H:i:s');
    $msg = trim((string) in('reply', ''));
    $files = ticket_files((string) in('file_ids', ''), null);
    if ($msg !== '' || $files !== '') {
        insert('ticket_messages', ['ticket_id' => $id, 'author_type' => 'staff', 'author_id' => $me['id'], 'message' => $msg, 'file_ids' => $files ?: null]);
        $upd['last_reply_by'] = 'staff'; $upd['reply'] = $msg ?: $t['reply'];
        if ($msg) notify_user((int) $t['user_id'], 'ticket_reply', ['ticket_no' => $t['ticket_no'], 'message' => mb_substr($msg, 0, 300)]);
    }
    if (($st = in('status')) && isset(TICKET_STATUSES[$st]) && $st !== $t['status']) {
        $upd['status'] = $st; ticket_event((int)$id, 'Status changed to ' . TICKET_STATUSES[$st] . ' by ' . $me['name'], (int)$me['id']); $upd['last_reply_by'] = 'staff';
    }
    if (in('priority') && in_array(in('priority'), ['low', 'normal', 'high', 'urgent']) && in('priority') !== $t['priority']) { $upd['priority'] = in('priority'); ticket_event((int)$id, 'Priority set to ' . ucfirst((string) in('priority')), (int)$me['id']); }
    if (array_key_exists('assignee_id', body())) {
        $aid = (int) in('assignee_id') ?: null;
        if ($aid !== ($t['assignee_id'] ? (int)$t['assignee_id'] : null)) { $upd['assignee_id'] = $aid; ticket_event((int)$id, $aid ? 'Assigned to ' . val("SELECT name FROM users WHERE id=?", [$aid]) : 'Unassigned', (int)$me['id']); }
    }
    if (in('resolution') !== null) $upd['resolution'] = mb_substr((string) in('resolution'), 0, 2000);
    if ($upd) { $upd['updated_at'] = $now; if (($upd['last_reply_by'] ?? '') === 'staff') $upd['customer_seen_at'] = null; update('tickets', $upd, 'id=?', [$id]); }
    $t = one("SELECT t.*, COALESCE(u.business_name,u.name) customer, u.email customer_email, u.mobile customer_mobile FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?", [$id]);
    return ticket_full($t) + ['staff' => all("SELECT id, name FROM users WHERE role IN ('admin','staff') AND status='active' ORDER BY name"), 'statuses' => TICKET_STATUSES];
});
