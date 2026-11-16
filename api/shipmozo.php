<?php
// Shipmozo (multi-courier aggregator) API client.
// Auth: `public-key` + `private-key` headers (Shipmozo panel → Profile → API keys).
// Base URL and keys are set by admin (Admin → Courier APIs → Shipmozo). Every call is logged in API logs.

function shipmozo_on(): bool { return setting('shipmozo_enabled') === '1' && setting('shipmozo_public_key') !== '' && setting('shipmozo_private_key') !== ''; }
function shipmozo_base(): string { return rtrim(setting('shipmozo_base', 'https://shipping-api.com/app/api/v1'), '/'); }

function shipmozo_http(string $method, string $path, ?array $payload = null, string $api = 'Shipmozo', string $label = '') {
    $url = shipmozo_base() . '/' . ltrim($path, '/');
    if ($method === 'GET' && $payload) { $url .= '?' . http_build_query($payload); $payload = null; }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['public-key: ' . setting('shipmozo_public_key'), 'private-key: ' . setting('shipmozo_private_key'), 'Content-Type: application/json', 'Accept: application/json']]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $j = is_string($res) ? json_decode($res, true) : null;
    $ok = $res !== false && $code >= 200 && $code < 300 && is_array($j) && (($j['result'] ?? '1') . '' !== '0') && (($j['status'] ?? true) !== false);
    api_log('Shipmozo · ' . $api, $label ?: $path, $ok ? 'success' : 'failed', $err ?: $res);
    $msg = '';
    if (is_array($j)) {
        $msg = (string) ($j['message'] ?? (is_string($j['error'] ?? null) ? $j['error'] : ''));
        $det = $j['data']['error'] ?? ($j['data']['errors'] ?? ($j['errors'] ?? null));
        if (is_array($det)) { $flat = []; array_walk_recursive($det, function ($v) use (&$flat) { $flat[] = $v; }); $det = implode('; ', $flat); }
        if ($det && stripos($msg, (string) $det) === false) $msg = trim(($msg && strcasecmp($msg, 'error') !== 0 ? $msg . ': ' : '') . $det);
    } elseif (!$err && $res !== false) $msg = 'HTTP ' . $code;
    return ['ok' => $ok, 'code' => $code, 'json' => $j, 'raw' => $res, 'error' => $err ?: $msg];
}

/** pull a value from a response row using several possible key names */
function sm_pick(array $row, array $keys, $default = null) {
    foreach ($keys as $k) if (isset($row[$k]) && $row[$k] !== '') return $row[$k];
    return $default;
}
function sm_data($j) { return is_array($j) ? ($j['data'] ?? $j['result_data'] ?? $j) : []; }

function shipmozo_box_dims(array $bl): array {
    return array_map(fn($x) => ['no_of_box' => (string) max(1, (int) $x['n']), 'length' => (string) max(1, (int) round($x['l'])), 'width' => (string) max(1, (int) round($x['b'])), 'height' => (string) max(1, (int) round($x['h']))], $bl);
}
/** push-order box list — MPS needs each box's own weight (grams), split from the total by box volume */
function shipmozo_push_dims(array $bl, float $totalKg): array {
    $vol = 0; foreach ($bl as $x) $vol += max(1, $x['l'] * $x['b'] * $x['h']) * $x['n'];
    $g = max(1, (int) round($totalKg * 1000));
    return array_map(function ($x) use ($vol, $g) {
        $per = max(1, (int) round($g * max(1, $x['l'] * $x['b'] * $x['h']) / $vol));
        return ['no_of_box' => (string) max(1, (int) $x['n']), 'length' => (string) max(1, (int) round($x['l'])), 'width' => (string) max(1, (int) round($x['b'])),
            'height' => (string) max(1, (int) round($x['h'])), 'weight' => (string) $per];
    }, $bl);
}
function shipmozo_dims(array $s): array {
    return [['no_of_box' => (string) max(1, (int) ($s['boxes'] ?? 1)), 'length' => (string) max(1, (int) round($s['length'] ?? 10)), 'width' => (string) max(1, (int) round($s['breadth'] ?? 10)), 'height' => (string) max(1, (int) round($s['height'] ?? 10))]];
}

/** Rate options. Returns list of ['courier_id','name','base','days','eta','auto_pickup'] or [] */
function shipmozo_rates(string $from, string $to, float $kg, $l, $b, $h, string $payment, float $cod, float $value, int $boxes = 1, string $pkg = 'SPS', array $boxList = []): array {
    if (!shipmozo_on()) return [];
    static $cache = [];
    $key = md5(json_encode(func_get_args()));
    if (isset($cache[$key])) return $cache[$key];
    $r = shipmozo_http('POST', 'rate-calculator', [
        'pickup_pincode' => $from, 'delivery_pincode' => $to, 'payment_type' => $payment === 'cod' ? 'COD' : 'PREPAID', 'shipment_type' => 'FORWARD',
        'order_amount' => (string) max(1, round($value ?: $cod ?: 100)), 'type_of_package' => $pkg, 'rov_type' => setting('shipmozo_rov_type', 'ROV_OWNER'),
        'cod_amount' => $payment === 'cod' ? (string) round($cod) : '', 'weight' => (string) max(1, (int) round($kg * 1000)),
        'dimensions' => $boxList ? shipmozo_box_dims($boxList) : shipmozo_dims(['length' => $l, 'breadth' => $b, 'height' => $h, 'boxes' => $boxes]),
    ], 'Rate calculator', "$from → $to · $kg kg");
    $out = [];
    if ($r['ok']) foreach ((array) sm_data($r['json']) as $row) {
        if (!is_array($row)) continue;
        $price = (float) sm_pick($row, ['total_charges', 'total_charge', 'total_amount', 'freight_charges', 'rate', 'price'], 0);
        $id = sm_pick($row, ['courier_id', 'id', 'courier_company_id']);
        if ($price <= 0 || $id === null) continue;
        $gst = (float) sm_pick($row, ['gst', 'gst_amount', 'tax'], 0);
        $incl = sm_pick($row, ['gst_inclusive', 'is_gst_inclusive'], null);
        if ($gst > 0 && $incl !== false && $incl !== 0 && $incl !== '0') $price -= $gst; // keep base before GST
        $days = sm_pick($row, ['estimated_delivery_days', 'edd_days', 'tat', 'estimated_days']);
        $eta = sm_pick($row, ['estimated_delivery', 'edd', 'expected_delivery_date']);
        $out[] = ['courier_id' => (string) $id, 'name' => (string) sm_pick($row, ['name', 'courier_name', 'courier'], 'Courier ' . $id),
            'base' => round($price, 2), 'days' => $days ? "$days days" : '', 'eta' => $eta ? date('Y-m-d', strtotime((string) $eta)) : ($days ? date('Y-m-d', strtotime('+' . (int) $days . ' days')) : null),
            'auto_pickup' => strtoupper((string) sm_pick($row, ['pickups_automatically_scheduled'], 'YES')) !== 'NO', 'mode' => (string) sm_pick($row, ['mode', 'service_type'], '')];
    }
    usort($out, fn($a, $b) => $a['base'] <=> $b['base']);
    $max = (int) setting('shipmozo_max_options', 4);
    return $cache[$key] = array_slice($out, 0, max(1, $max));
}

/**
 * Each customer pickup address becomes its own warehouse on the Shipmozo panel (POST create-warehouse).
 * The id is saved on the pickup address; on failure the error is saved so the customer can retry.
 */
function shipmozo_ensure_warehouse(array $p, bool $force = false): ?string {
    if (!$force && !empty($p['sm_warehouse_id'])) return (string) $p['sm_warehouse_id'];
    if (!shipmozo_on()) return null;
    $phone = substr(preg_replace('/\D/', '', (string) $p['phone']), -10);
    $body = [
        'address_title' => mb_substr(trim(preg_replace('/\s+/', ' ', preg_replace('/[^A-Za-z0-9 ]/', ' ', 'VS' . $p['user_id'] . ' ' . $p['id'] . ' ' . $p['name']))), 0, 50),
        'name' => trim(preg_replace('/[^A-Za-z0-9 .]/', ' ', (string) ($p['contact'] ?: $p['name']))), 'phone' => (int) $phone, 'email' => (string) (val("SELECT email FROM users WHERE id=?", [$p['user_id']]) ?: ''),
        'address_line_one' => mb_substr((string) $p['address'], 0, 190), 'address_line_two' => trim(($p['city'] ?? '') . ', ' . ($p['state'] ?? ''), ', '),
        'pin_code' => (int) $p['pincode'],
    ];
    $r = shipmozo_http('POST', 'create-warehouse', $body, 'Create warehouse', $p['name'] . ' · ' . $p['pincode']);
    $d = sm_data($r['json']);
    $id = is_array($d) ? sm_pick($d, ['warehouse_id', 'id']) : null;
    if ($r['ok'] && $id) {
        update('pickup_addresses', ['sm_warehouse_id' => (string) $id, 'sm_error' => null], 'id=?', [$p['id']]);
        return (string) $id;
    }
    update('pickup_addresses', ['sm_error' => mb_substr($r['error'] ?: 'Courier partner did not return a warehouse ID', 0, 250)], 'id=?', [$p['id']]);
    return null;
}

/** Push order + assign courier (+ schedule pickup when needed). Returns ['ok','awb','order_id','error'] */
function shipmozo_create(array $s, string $courierId): array {
    $p = !empty($s['pickup_id']) ? one("SELECT * FROM pickup_addresses WHERE id=?", [$s['pickup_id']]) : null;
    $wh = ($p ? shipmozo_ensure_warehouse($p) : null) ?: setting('shipmozo_warehouse_id');
    if (!$wh) return ['ok' => false, 'error' => 'Pickup address is not registered on Shipmozo yet' . ($p && $p['sm_error'] ? ' (' . $p['sm_error'] . ')' : '') . ' — open Pickup addresses and retry.'];
    $bl = json_decode((string) ($s['box_list'] ?? ''), true) ?: [];
    $bl = norm_boxes($s['length'] ?? 10, $s['breadth'] ?? 10, $s['height'] ?? 10, max(1, (int) ($s['boxes'] ?? 1)), $bl);
    $nBoxes = array_sum(array_column($bl, 'n'));
    $pkg = ($s['ship_type'] ?? 'b2c') === 'b2b' ? setting('shipmozo_b2b_package_type', 'B2B') : ($nBoxes > 1 ? 'MPS' : setting('shipmozo_package_type', 'SPS'));
    $push = shipmozo_http('POST', 'push-order', [
        'order_id' => $s['order_no'], 'order_date' => date('Y-m-d'), 'order_type' => 'ESSENTIALS',
        'consignee_name' => $s['to_name'], 'consignee_phone' => (int) substr(preg_replace('/\D/', '', (string) $s['to_phone']), -10), 'consignee_email' => '',
        'consignee_address_line_one' => mb_substr((string) $s['to_address'], 0, 190), 'consignee_address_line_two' => '',
        'consignee_pin_code' => (int) $s['to_pincode'], 'consignee_city' => (string) $s['to_city'], 'consignee_state' => (string) $s['to_state'],
        'product_detail' => [['name' => $s['product'] ?: 'Goods', 'sku_number' => $s['order_no'], 'quantity' => 1, 'discount' => '', 'hsn' => (string) ($s['hsn'] ?? ''), 'unit_price' => max(1, (float) $s['invoice_value']), 'product_category' => 'Other']],
        'payment_type' => $s['payment_mode'] === 'cod' ? 'COD' : 'PREPAID', 'cod_amount' => $s['payment_mode'] === 'cod' ? (string) round((float) $s['cod_amount']) : '',
        'weight' => max(1, (int) round($s['weight'] * 1000)), 'length' => max(1, (int) round($s['length'] ?: 10)), 'width' => max(1, (int) round($s['breadth'] ?: 10)), 'height' => max(1, (int) round($s['height'] ?: 10)),
        'warehouse_id' => $wh, 'gst_ewaybill_number' => (string) ($s['ewaybill_no'] ?? ''), 'gstin_number' => '',
        // every box goes to the courier (same format as the rate calculator) so each box gets its own label / barcode
        'type_of_package' => $pkg, 'no_of_box' => (string) $nBoxes, 'number_of_boxes' => $nBoxes, 'dimensions' => shipmozo_push_dims($bl, (float) $s['weight']),
    ], 'Push order', 'Order #' . $s['order_no'] . ($nBoxes > 1 ? " · $nBoxes boxes ($pkg)" : ''));
    $dup = !$push['ok'] && preg_match('/already|exist|duplicate/i', (string) $push['error']);
    if (!$push['ok'] && !$dup) return ['ok' => false, 'error' => 'Courier booking failed: ' . ($push['error'] ?: 'check keys / warehouse ID')];
    $d = sm_data($push['json']);
    $oid = (string) (is_array($d) ? sm_pick($d, ['order_id', 'refrence_id', 'reference_id', 'id'], $s['order_no']) : $s['order_no']);
    $as = shipmozo_http('POST', 'assign-courier', ['order_id' => $oid, 'courier_id' => $courierId], 'Assign courier', "#$oid → $courierId");
    $ad = sm_data($as['json']);
    $awb = is_array($ad) ? sm_pick($ad, ['awb_number', 'awb', 'waybill']) : null;
    if (!$as['ok'] && !preg_match('/already|assigned/i', (string) $as['error'])) return ['ok' => false, 'order_id' => $oid, 'error' => 'Courier assignment failed: ' . ($as['error'] ?: 'no AWB returned')];
    if (setting('shipmozo_schedule_pickup', 'auto') !== 'never') {
        $sp = shipmozo_http('POST', 'schedule-pickup', ['order_id' => $oid], 'Schedule pickup', "#$oid");
        $sd = sm_data($sp['json']);
        if (!$awb && is_array($sd)) $awb = sm_pick($sd, ['awb_number', 'awb']);
    }
    if (!$awb) { // some couriers hand out the AWB a moment later — read the order back
        $od = shipmozo_http('GET', 'get-order-detail/' . rawurlencode($oid), null, 'Order detail', "#$oid");
        $j = json_encode($od['json'] ?? []);
        if (preg_match('/"awb_number"\s*:\s*"?([A-Za-z0-9]+)/', $j, $m)) $awb = $m[1];
    }
    if (!$awb) return ['ok' => false, 'order_id' => $oid, 'error' => 'The courier was assigned it has not returned an AWB yet — please try again in a minute.'];
    $child = $nBoxes > 1 ? shipmozo_child_awbs([$as['json'] ?? null, $sd ?? null], (string) $awb) : [];
    if ($nBoxes > 1 && !$child) {   // read the order back for per-box AWBs
        $od = shipmozo_http('GET', 'get-order-detail/' . rawurlencode($oid), null, 'Order detail', "#$oid · boxes");
        $child = shipmozo_child_awbs([$od['json'] ?? null], (string) $awb);
    }
    return ['ok' => true, 'awb' => (string) $awb, 'order_id' => $oid, 'child_awbs' => $child];
}

/** per-box (child / MPS) AWBs found anywhere in Shipmozo responses, excluding the master AWB */
function shipmozo_child_awbs(array $jsons, string $master): array {
    $out = [];
    foreach ($jsons as $j) {
        if (!is_array($j)) continue;
        array_walk_recursive($j, function ($v, $k) use (&$out) {
            if (is_string($k) && preg_match('/awb|waybill/i', $k) && (is_string($v) || is_int($v)) && preg_match('/^[A-Za-z0-9]{6,}$/', (string) $v)) $out[] = (string) $v;
        });
        foreach (['child_awb', 'child_awbs', 'mps_awb', 'mps_awbs', 'awb_numbers', 'child_waybills', 'packages'] as $key) {
            $f = sm_find($j, $key);
            if (is_string($f)) foreach (preg_split('/[\s,]+/', $f) as $x) if (preg_match('/^[A-Za-z0-9]{6,}$/', $x)) $out[] = $x;
        }
    }
    return array_values(array_diff(array_unique($out), [$master]));
}
function sm_find($a, string $key) {
    if (!is_array($a)) return null;
    foreach ($a as $k => $v) { if ($k === $key) return $v; if (is_array($v) && ($r = sm_find($v, $key)) !== null) return $r; }
    return null;
}

/** courier's own labels from Shipmozo — every box/page is returned:
 *  ['items' => [['url'=>..] | ['pdf'=>binary] | ['img'=>binary], …]] or ['error'=>..] */
function shipmozo_label(string $awb): array {
    $r = shipmozo_http('GET', 'get-order-label/' . rawurlencode($awb), null, 'Order label', $awb);
    if (!$r['ok']) return ['error' => $r['error'] ?: 'Label not available yet'];
    $d = sm_data($r['json']);
    $flat = [];
    if (is_array($d)) array_walk_recursive($d, function ($v, $k) use (&$flat) { $flat[] = [$k, $v]; }); else $flat[] = ['data', $d];
    $items = []; $seen = [];
    foreach ($flat as [$k, $v]) {
        if (!is_string($v) || isset($seen[$v])) continue;
        if (preg_match('#^https?://#', $v) && preg_match('/label|pdf|png|jpe?g|print|download|s3|storage/i', $v . $k)) { $items[] = ['url' => $v]; $seen[$v] = 1; continue; }
        if (strlen($v) > 200) {
            $b = base64_decode(preg_replace('#^data:[^,]+,#', '', $v), true);
            if ($b !== false && str_starts_with($b, '%PDF')) { $items[] = ['pdf' => $b]; $seen[$v] = 1; }
            elseif ($b !== false && preg_match('/^\x89PNG|^\xFF\xD8/', $b)) { $items[] = ['img' => $b]; $seen[$v] = 1; }
        }
    }
    if (!$items) foreach ($flat as [$k, $v]) if (is_string($v) && preg_match('#^https?://#', $v)) { $items[] = ['url' => $v]; break; }
    return $items ? ['items' => $items] : ['error' => 'Courier partner returned the label in an unexpected format (see API logs)'];
}

function shipmozo_track(string $awb): ?array {
    $r = shipmozo_http('GET', 'track-order', ['awb_number' => $awb], 'Track order', $awb);
    if (!$r['ok']) return null;
    $d = sm_data($r['json']);
    return is_array($d) ? $d : null;
}

function map_shipmozo_status(string $st): ?string {
    $s = strtolower($st);
    if ($s === '') return null;
    if (str_contains($s, 'rto') && str_contains($s, 'deliver')) return 'rto_delivered';
    if (str_contains($s, 'rto') || str_contains($s, 'return')) return 'rto_in_transit';
    if (str_contains($s, 'out for delivery')) return 'out_for_delivery';
    if (str_contains($s, 'deliver')) return 'delivered';
    if (str_contains($s, 'undeliver') || str_contains($s, 'ndr') || str_contains($s, 'failed')) return 'ndr';
    if (str_contains($s, 'cancel')) return 'cancelled';
    if (str_contains($s, 'picked')) return 'picked_up';
    if (str_contains($s, 'transit') || str_contains($s, 'dispatch') || str_contains($s, 'shipped')) return 'in_transit';
    if (str_contains($s, 'pickup') || str_contains($s, 'manifest') || str_contains($s, 'booked')) return 'pickup_pending';
    return null;
}

function shipmozo_cancel(array $s): bool {
    return shipmozo_http('POST', 'cancel-order', ['order_id' => $s['provider_order_id'] ?: $s['order_no'], 'awb_number' => $s['awb']], 'Cancel order', (string) $s['awb'])['ok'];
}

function shipmozo_test(): array {
    if (setting('shipmozo_public_key') === '' || setting('shipmozo_private_key') === '') return ['ok' => false, 'message' => 'Add Shipmozo public & private key first.'];
    $r = shipmozo_http('GET', 'get-warehouses', null, 'Test connection', 'get-warehouses');
    $list = [];
    foreach ((array) sm_data($r['json']) as $w) if (is_array($w)) $list[] = ['id' => (string) sm_pick($w, ['id', 'warehouse_id']), 'name' => (string) sm_pick($w, ['address_title', 'name', 'warehouse_name'], ''), 'pincode' => (string) sm_pick($w, ['pincode', 'pin_code'], '')];
    return $r['ok'] ? ['ok' => true, 'message' => 'Connected to Shipmozo · ' . count($list) . ' warehouse(s)', 'warehouses' => $list]
        : ['ok' => false, 'message' => 'Shipmozo rejected the request (HTTP ' . $r['code'] . '). ' . ($r['error'] ?: 'Check keys and base URL.')];
}
