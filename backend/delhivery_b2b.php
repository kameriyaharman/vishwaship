<?php
// Delhivery B2B (LTL / heavy cargo) — https://ltl-clients-api.delhivery.com
// Login with API username + password → JWT (Bearer). Shipments are identified by LR number (LRN).
// Flow: pincode-service → freight/estimate (rate) → client-warehouse/create (once per pickup address)
//       → manifest (async job → LRN) → pickup_requests → generate/shipping_label → lrn/track → lrn/cancel

function b2b_on(): bool { return setting('dlvb2b_enabled') === '1' && setting('dlvb2b_username') !== '' && setting('dlvb2b_password') !== ''; }
function b2b_base(): string { return rtrim(setting('dlvb2b_base', 'https://ltl-clients-api.delhivery.com'), '/'); }

/** raw HTTP; $form = multipart fields (manifest) instead of JSON */
function b2b_raw(string $method, string $path, $payload = null, ?string $jwt = null, bool $form = false): array {
    $url = b2b_base() . '/' . ltrim($path, '/');
    if ($method === 'GET' && is_array($payload) && $payload) { $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($payload); $payload = null; }
    $h = ['Accept: application/json'];
    if ($jwt) $h[] = 'Authorization: Bearer ' . $jwt;
    if (!$form) $h[] = 'Content-Type: application/json';
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $h]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $form ? $payload : json_encode($payload));
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $j = is_string($res) ? json_decode(preg_replace('/[\x00-\x1F]/', '', $res), true) : null;
    return ['code' => $code, 'json' => is_array($j) ? $j : null, 'raw' => $res, 'err' => $err];
}

function b2b_jwt(bool $refresh = false): ?string {
    $tok = setting('dlvb2b_jwt', '');
    if (!$refresh && $tok && (time() - (int) setting('dlvb2b_jwt_at', '0')) < 6 * 3600) return $tok;
    // after a failed login wait 5 minutes before trying again (keeps rate checks fast)
    if (!$refresh && (time() - (int) setting('dlvb2b_fail_at', '0')) < 300) return null;
    $r = b2b_raw('POST', 'ums/login', ['username' => setting('dlvb2b_username'), 'password' => setting('dlvb2b_password')]);
    $jwt = $r['json']['data']['jwt'] ?? ($r['json']['jwt'] ?? null);
    api_log('Delhivery B2B · Login', setting('dlvb2b_username'), $jwt ? 'success' : 'failed', $jwt ? 'JWT received' : ($r['err'] ?: $r['raw']));
    if (!$jwt) { set_setting('dlvb2b_fail_at', (string) time()); return null; }
    set_setting('dlvb2b_fail_at', '0');
    set_setting('dlvb2b_jwt', $jwt); set_setting('dlvb2b_jwt_at', (string) time());
    return $jwt;
}

/** authenticated call with one automatic re-login on 401/403 */
function b2b_http(string $method, string $path, $payload = null, string $api = '', string $label = '', bool $form = false): array {
    $jwt = b2b_jwt();
    if (!$jwt) return ['ok' => false, 'json' => null, 'error' => 'Delhivery B2B login failed — check API username / password'];
    $r = b2b_raw($method, $path, $payload, $jwt, $form);
    if (in_array($r['code'], [401, 403], true) && ($jwt = b2b_jwt(true))) $r = b2b_raw($method, $path, $payload, $jwt, $form);
    $j = $r['json'];
    $ok = $r['raw'] !== false && $r['code'] >= 200 && $r['code'] < 300 && is_array($j) && (($j['success'] ?? true) !== false);
    $msg = is_array($j) ? ($j['error']['message'] ?? ($j['message'] ?? ($j['error'] ?? ''))) : '';
    if (is_array($msg)) $msg = json_encode($msg);
    api_log('Delhivery B2B · ' . ($api ?: $path), $label ?: $path, $ok ? 'success' : 'failed', $r['err'] ?: $r['raw']);
    return ['ok' => $ok, 'code' => $r['code'], 'json' => $j, 'error' => $r['err'] ?: (string) $msg ?: ('HTTP ' . $r['code'])];
}

function b2b_test(): array {
    if (setting('dlvb2b_username') === '' || setting('dlvb2b_password') === '') return ['ok' => false, 'message' => 'Enter the B2B API username and password first'];
    $jwt = b2b_jwt(true);
    if (!$jwt) return ['ok' => false, 'message' => 'Login failed — check username / password (see API logs)'];
    $r = b2b_http('GET', 'pincode-service/110001', ['weight' => 10], 'Pincode check', '110001');
    return ['ok' => true, 'message' => 'Logged in to Delhivery B2B' . ($r['ok'] ? ' · serviceability API working' : ' · login OK, but pincode API said: ' . $r['error'])];
}

/** ['serviceable'=>bool,'oda'=>bool] or null if the API could not be reached */
function b2b_serviceable(string $pin, float $kg): ?array {
    static $c = [];
    $k = "$pin|" . ceil($kg);
    if (isset($c[$k])) return $c[$k];
    $r = b2b_http('GET', 'pincode-service/' . $pin, ['weight' => max(1, ceil($kg))], 'Pincode check', $pin);
    if (!$r['ok'] && !is_array($r['json'])) return $c[$k] = null;
    $d = $r['json']['data'] ?? [];
    $fail = array_map('strval', (array) ($d['b2b_fail_on_demand_pincodes'] ?? []));
    $rows = (array) ($d['pincode_serviceability_data'] ?? []);
    $ok = $r['ok'] && $rows && !in_array($pin, $fail, true);
    return $c[$k] = ['serviceable' => (bool) $ok, 'oda' => (bool) ($rows[0]['oda'] ?? false)];
}

/** freight estimate → base cost (₹, before our GST) or null */
function b2b_estimate(string $from, string $to, float $kg, $l, $b, $h, int $boxes, string $payment, float $cod, float $value): ?array {
    static $c = [];
    $key = json_encode(func_get_args());
    if (array_key_exists($key, $c)) return $c[$key];
    $sf = b2b_serviceable($to, $kg);
    if (!$sf || !$sf['serviceable']) return $c[$key] = null;
    $body = [
        'dimensions' => [['length_cm' => (float) ($l ?: 10), 'width_cm' => (float) ($b ?: 10), 'height_cm' => (float) ($h ?: 10), 'box_count' => max(1, $boxes)]],
        'weight_g' => (int) round($kg * 1000), 'source_pin' => $from, 'consignee_pin' => $to,
        'payment_mode' => $payment === 'cod' ? 'cod' : 'prepaid', 'inv_amount' => (float) ($value ?: $cod ?: 1), 'cod_amount' => $payment === 'cod' ? (float) $cod : 0,
        'freight_mode' => setting('dlvb2b_freight_mode', 'fop'), 'rov_insurance' => setting('dlvb2b_rov', '0') === '1',
    ];
    $r = b2b_http('POST', 'freight/estimate', $body, 'Freight estimate', "$from → $to · {$kg}kg");
    if (!$r['ok']) return $c[$key] = null;
    $d = $r['json']['data'] ?? [];
    $pb = (array) ($d['price_breakup'] ?? []);
    // total before GST: prefer explicit pre-tax totals, else sum the components, else the grand total
    $base = $pb['pre_tax_freight_charges'] ?? ($pb['pre_tax_amount'] ?? ($d['pre_tax_amount'] ?? null));
    if ($base === null && $pb) { $s = 0; foreach ($pb as $k => $v) if (is_numeric($v) && !preg_match('/gst|tax|total/i', $k)) $s += (float) $v; $base = $s ?: null; }
    $base = $base ?? ($d['total'] ?? ($d['total_amount'] ?? ($pb['total'] ?? null)));
    if (!is_numeric($base) || $base <= 0) return $c[$key] = null;
    return $c[$key] = ['base' => round((float) $base, 2), 'oda' => $sf['oda'], 'tat' => $d['tat'] ?? ($d['estimated_tat'] ?? null)];
}

/** each customer pickup address is registered once as a B2B client warehouse */
function b2b_ensure_warehouse(array $p, bool $force = false): ?string {
    if (!$force && !empty($p['b2b_wh_name'])) return (string) $p['b2b_wh_name'];
    if (!b2b_on()) return null;
    $name = mb_substr('VS' . $p['user_id'] . '-' . $p['id'] . ' ' . preg_replace('/[^A-Za-z0-9 ]/', '', (string) $p['name']), 0, 50);
    $r = b2b_http('POST', 'client-warehouse/create/', [
        'pin_code' => (string) $p['pincode'], 'city' => (string) $p['city'], 'state' => (string) $p['state'], 'country' => 'India', 'name' => $name,
        'address_details' => ['address' => (string) $p['address'], 'contact_person' => (string) ($p['contact'] ?: $p['name']), 'phone_number' => substr(preg_replace('/\D/', '', (string) $p['phone']), -10)],
        'ret_address' => ['address' => (string) $p['address'], 'pin' => (string) $p['pincode']],
    ], 'Create warehouse', $name);
    $exists = !$r['ok'] && preg_match('/already|exist/i', (string) $r['error']);
    if ($r['ok'] || $exists) { update('pickup_addresses', ['b2b_wh_name' => $name, 'b2b_error' => null], 'id=?', [$p['id']]); return $name; }
    if (!str_contains((string) $r['error'], 'login failed')) // credentials are an admin issue, not the customer's address
        update('pickup_addresses', ['b2b_error' => mb_substr($r['error'] ?: 'Delhivery B2B did not accept this address', 0, 250)], 'id=?', [$p['id']]);
    return null;
}

/** manifest the shipment; returns ['ok','awb'(LRN or PENDING-job),'job_id','error'] */
function b2b_create(array $s, array $p): array {
    $wh = b2b_ensure_warehouse($p);
    if (!$wh) { $p = one("SELECT * FROM pickup_addresses WHERE id=?", [$p['id']]); return ['ok' => false, 'error' => 'Pickup address is not registered with Delhivery B2B' . ($p['b2b_error'] ? ' (' . $p['b2b_error'] . ')' : '')]; }
    $boxes = max(1, (int) ($s['boxes'] ?? 1));
    $fields = [
        'lrn' => '', 'pickup_location_name' => $wh, 'payment_mode' => $s['payment_mode'] === 'cod' ? 'cod' : 'prepaid',
        'cod_amount' => (string) ($s['payment_mode'] === 'cod' ? round((float) $s['cod_amount']) : 0),
        'weight' => (string) (int) round((float) $s['weight'] * 1000),
        'dropoff_location' => json_encode(['consignee_name' => $s['to_name'], 'address' => $s['to_address'], 'city' => (string) $s['to_city'], 'state' => (string) $s['to_state'], 'zip' => $s['to_pincode'], 'phone' => $s['to_phone'], 'email' => '']),
        'rov_insurance' => setting('dlvb2b_rov', '0') === '1' ? 'true' : 'false',
        'invoices' => json_encode([['inv_num' => $s['order_ref'] ?: $s['order_no'], 'inv_amt' => (float) $s['invoice_value'], 'ewaybill' => (string) ($s['ewaybill_no'] ?? ''), 'inv_qr_code' => '']]),
        'shipment_details' => json_encode([['order_id' => $s['order_no'], 'box_count' => $boxes, 'description' => $s['product'] ?: 'Goods']]),
        'dimensions' => json_encode([['length' => (float) ($s['length'] ?: 10), 'width' => (float) ($s['breadth'] ?: 10), 'height' => (float) ($s['height'] ?: 10), 'box_count' => $boxes]]),
        'fm_pickup' => 'true', 'freight_mode' => setting('dlvb2b_freight_mode', 'fop'),
        'billing_address' => json_encode(['name' => setting('company_name', 'Vishwaship'), 'company' => setting('company_name', 'Vishwaship'), 'consignor' => $s['from_contact'] ?: $s['from_name'],
            'address' => setting('company_address', ''), 'city' => setting('company_city', 'New Delhi'), 'state' => setting('company_state', 'Delhi'), 'pin' => setting('company_pincode', '110075'),
            'phone' => substr(preg_replace('/\D/', '', setting('company_phone', '') ?: (string) $s['from_phone']), -10), 'gst_number' => setting('company_gstin', '')]),
    ];
    $r = b2b_http('POST', 'manifest', $fields, 'Manifest', 'Order #' . $s['order_no'], true);
    $job = $r['json']['job_id'] ?? ($r['json']['data']['job_id'] ?? null);
    if (!$r['ok'] || !$job) return ['ok' => false, 'error' => 'Delhivery B2B manifest failed: ' . ($r['error'] ?: 'no job id returned')];
    for ($i = 0; $i < 6; $i++) { // usually completes in a few seconds
        sleep(2);
        $st = b2b_job((string) $job);
        if ($st['state'] === 'done') return ['ok' => true, 'awb' => $st['lrn'], 'job_id' => (string) $job, 'waybills' => $st['waybills']];
        if ($st['state'] === 'error') return ['ok' => false, 'error' => 'Delhivery B2B rejected the shipment: ' . $st['error']];
    }
    return ['ok' => true, 'awb' => 'PENDING-' . $job, 'job_id' => (string) $job, 'pending' => true];
}

/** manifest job status → ['state'=>done|pending|error,'lrn','waybills','error'] */
function b2b_job(string $job): array {
    $r = b2b_http('GET', 'manifest', ['job_id' => $job], 'Manifest status', $job);
    $j = $r['json'] ?? [];
    $d = $j['data'] ?? [];
    if (($j['success'] ?? false) && ($d['status'] ?? '') === 'Complete' && !empty($d['lrnum'])) return ['state' => 'done', 'lrn' => (string) $d['lrnum'], 'waybills' => implode(',', (array) ($d['waybills'] ?? [])), 'error' => ''];
    $type = $j['status']['type'] ?? ''; $val = $j['status']['value'] ?? '';
    if (($type === 'Complete' && in_array($val, ['DataError', 'RemoteError'], true)) || ($j['message'] ?? '') === 'Manifestation details not found')
        return ['state' => 'error', 'lrn' => '', 'waybills' => '', 'error' => is_string($j['message'] ?? null) ? $j['message'] : ($val ?: 'error')];
    return ['state' => 'pending', 'lrn' => '', 'waybills' => '', 'error' => ''];
}

function b2b_pickup_request(string $wh, string $date, int $boxes): bool {
    $r = b2b_http('POST', 'pickup_requests/', ['client_warehouse' => $wh, 'pickup_date' => $date, 'start_time' => '14:00:00', 'expected_package_count' => max(1, $boxes)], 'Pickup request', "$wh · $date · $boxes box");
    return $r['ok'] || (($r['json']['data']['pr_exist'] ?? 0) == 1);
}

/** Delhivery LR / box labels (PDF). size: sm | md | a4 → presigned URL or null (still generating) */
function b2b_label(string $lrn, string $size = 'sm'): array {
    $jobKey = "b2b_label_{$lrn}_{$size}";
    $job = setting($jobKey, '');
    if (!$job) {
        $r = b2b_http('POST', 'generate/shipping_label', ['lrns' => [$lrn], 'size' => $size], 'Label', $lrn);
        $job = (string) ($r['json']['data']['job_id'] ?? '');
        if (!$job) return ['ok' => false, 'error' => $r['error'] ?: 'Label job not created'];
        set_setting($jobKey, $job);
    }
    for ($i = 0; $i < 4; $i++) {
        $s = b2b_http('GET', 'generate/shipping_label/status/' . $job, null, 'Label status', $lrn);
        $d = $s['json']['data'] ?? [];
        if (($d['job_status'] ?? '') === 'success' && !empty($d['presigned_url'])) return ['ok' => true, 'url' => $d['presigned_url']];
        if (in_array($d['job_status'] ?? '', ['failed', 'error'], true)) { set_setting($jobKey, ''); return ['ok' => false, 'error' => 'Label generation failed']; }
        sleep(2);
    }
    return ['ok' => false, 'pending' => true, 'error' => 'Label is still being generated — try again in a minute'];
}

function b2b_track(string $lrn): ?array {
    $r = b2b_http('GET', 'lrn/track', ['lrnum' => $lrn], 'Track', $lrn);
    return $r['ok'] ? ($r['json']['data']['wbns'][0] ?? null) : null;
}

function map_b2b_status(string $st): ?string {
    $st = strtoupper($st);
    return match (true) {
        in_array($st, ['MANIFESTED', 'CREATED', 'NOT_PICKED', 'NOT_PICKED_UP', 'OUT_FOR_PICKUP', 'READY_FOR_DISPATCH', 'PREPERD'], true) => 'pickup_pending',
        in_array($st, ['PICKED', 'PICKED_UP'], true) => 'picked_up',
        in_array($st, ['IN_TRANSIT', 'RECEIVED_AT_OU', 'IN_PROCESS', 'ON_HOLD', 'HOLD'], true) => 'in_transit',
        in_array($st, ['OUT_FOR_DELIVERY', 'OUTDLV'], true) => 'out_for_delivery',
        in_array($st, ['DELIVERED', 'DLVD', 'DDLVD'], true) => 'delivered',
        in_array($st, ['UNDELIVERED', 'DUNDL'], true) => 'ndr',
        in_array($st, ['RETURN_OFD', 'RECEIVED_AT_RETURN_CENTER', 'RETURNED_INTRANSIT', 'RTO_IN_TRANSIT', 'RTON', 'RTOW', 'DRTO', 'REDRTO'], true) => 'rto_in_transit',
        in_array($st, ['RETURN_DELIVERED', 'RTO_DELIVERED', 'RTODLV'], true) => 'rto_delivered',
        in_array($st, ['CANCEL', 'CANCELED', 'CANCELLED', 'DELETED', 'CAND'], true) => 'cancelled',
        $st === 'LOST' => 'lost',
        default => null,
    };
}

function b2b_cancel(array $s): bool {
    if (str_starts_with((string) $s['awb'], 'PENDING-')) return true;
    $r = b2b_http('DELETE', 'lrn/cancel/' . $s['awb'], null, 'Cancel', (string) $s['awb']);
    return $r['ok'];
}

/** called from delhivery_sync(): finish pending manifests + pull LR statuses */
function b2b_sync(): int {
    if (!b2b_on()) return 0;
    $n = 0;
    foreach (all("SELECT * FROM shipments WHERE provider='dlvb2b' AND awb LIKE 'PENDING-%' AND status='pickup_pending' LIMIT 50") as $s) {
        $st = b2b_job((string) $s['provider_order_id']);
        if ($st['state'] === 'done') {
            update('shipments', ['awb' => $st['lrn']], 'id=?', [$s['id']]);
            q("UPDATE wallet_txns SET ref=?, description=REPLACE(description, ?, ?) WHERE ref=?", [$st['lrn'], $s['awb'], $st['lrn'], $s['awb']]);
            add_event((int) $s['id'], 'pickup_pending', 'LR generated · ' . $st['lrn'], 'Delhivery B2B'); $n++;
        } elseif ($st['state'] === 'error') {
            add_event((int) $s['id'], 'pickup_pending', 'Delhivery B2B could not manifest this shipment', '', $st['error']);
        }
    }
    foreach (all("SELECT * FROM shipments WHERE provider='dlvb2b' AND awb NOT LIKE 'PENDING-%' AND status NOT IN ('delivered','rto_delivered','cancelled') LIMIT 200") as $s) {
        $d = b2b_track((string) $s['awb']); if (!$d) continue;
        $raw = (string) ($d['status'] ?? '');
        $new = map_b2b_status($raw);
        if ($new && $new !== $s['status']) { apply_status($s, $new, $raw, (string) ($d['location'] ?? ($d['current_location'] ?? '')), (string) ($d['scan_remark'] ?? '')); $n++; }
    }
    return $n;
}
