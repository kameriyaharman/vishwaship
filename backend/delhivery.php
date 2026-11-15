<?php
// Delhivery B2C API client. When admin sets mode = "live" and adds a token, real calls are made.
// In "simulation" mode the portal works end-to-end using the admin rate card and generated AWBs.

function delhivery_live(): bool { return setting('delhivery_mode') === 'live' && setting('delhivery_token') !== ''; }
function delhivery_base(): string { return setting('delhivery_env') === 'production' ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com'; }

function delhivery_http(string $method, string $path, $payload = null, bool $form = false, string $api = 'API', string $reqLabel = '', bool $raw = false) {
    $url = delhivery_base() . $path;
    $ch = curl_init();
    $headers = ['Authorization: Token ' . setting('delhivery_token'), 'Accept: application/json'];
    if ($method === 'GET' && is_array($payload)) { $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($payload); $payload = null; }
    curl_setopt_array($ch, [CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $method]);
    if ($payload !== null) {
        if ($form) { curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($payload) ? http_build_query($payload) : $payload); $headers[] = 'Content-Type: application/x-www-form-urlencoded'; }
        else { curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload)); $headers[] = 'Content-Type: application/json'; }
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    $ok = $res !== false && $code >= 200 && $code < 300;
    api_log($api, $reqLabel ?: $path, $ok ? 'success' : 'failed', $err ?: $res);
    if (!$ok) return null;
    if ($raw) return $res;
    $j = json_decode($res, true);
    return $j ?? $res;
}

function delhivery_serviceability(string $pin): array {
    if (!delhivery_live()) {
        $ok = preg_match('/^[1-9]\d{5}$/', $pin) === 1;
        return ['serviceable' => $ok, 'prepaid' => $ok, 'cod' => $ok, 'pickup' => $ok, 'reverse' => $ok];
    }
    $r = delhivery_http('GET', '/c/api/pin-codes/json/', ['filter_codes' => $pin], false, 'Pincode serviceability', $pin);
    $d = $r['delivery_codes'][0]['postal_code'] ?? null;
    if (!$d) return ['serviceable' => false, 'prepaid' => false, 'cod' => false, 'pickup' => false, 'reverse' => false];
    return ['serviceable' => true, 'prepaid' => ($d['pre_paid'] ?? 'N') === 'Y', 'cod' => ($d['cod'] ?? 'N') === 'Y',
        'pickup' => ($d['pickup'] ?? 'N') === 'Y', 'reverse' => ($d['repl'] ?? 'N') === 'Y', 'city' => $d['city'] ?? null, 'state' => $d['state_code'] ?? null];
}

/** Returns Delhivery base cost (pre-GST freight) or null to fall back to rate card */
function delhivery_cost(string $svc, string $from, string $to, float $kg, string $payment, float $cod): ?float {
    static $cache = [];
    $key = "$svc|$from|$to|$kg|$payment|$cod";
    if (isset($cache[$key])) return $cache[$key];
    $r = delhivery_http('GET', '/api/kinko/v1/invoice/charges/.json', ['md' => $svc === 'express' ? 'E' : 'S', 'ss' => 'Delivered',
        'o_pin' => $from, 'd_pin' => $to, 'cgm' => (int) round($kg * 1000), 'pt' => $payment === 'cod' ? 'COD' : 'Pre-paid', 'cod' => $cod],
        false, 'Shipping cost calculation', "$from → $to · $kg kg");
    $row = is_array($r) ? ($r[0] ?? null) : null;
    $val = $row ? (float) (($row['total_amount'] ?? 0) - ($row['tax_data']['IGST'] ?? 0) - ($row['tax_data']['CGST'] ?? 0) - ($row['tax_data']['SGST'] ?? 0)) : null;
    return $cache[$key] = ($val && $val > 0 ? round($val, 2) : null);
}

function delhivery_create_shipment(array $s, string $pickupName): array {
    if (!delhivery_live()) {
        $awb = (string) (149081108000 + (int) val("SELECT COUNT(*) FROM shipments") + mt_rand(100, 999));
        while (val("SELECT id FROM shipments WHERE awb=?", [$awb])) $awb = (string) ((int)$awb + 1);
        api_log('Create shipment (CMU)', 'Order #' . $s['order_no'] . ' (simulation)', 'success');
        return ['ok' => true, 'awb' => $awb];
    }
    $data = ['shipments' => [[
        'name' => $s['to_name'], 'add' => $s['to_address'], 'pin' => $s['to_pincode'], 'city' => $s['to_city'], 'state' => $s['to_state'],
        'country' => 'India', 'phone' => $s['to_phone'], 'order' => $s['order_no'], 'payment_mode' => $s['payment_mode'] === 'cod' ? 'COD' : 'Prepaid',
        'products_desc' => $s['product'], 'cod_amount' => $s['payment_mode'] === 'cod' ? $s['cod_amount'] : 0, 'order_date' => date('Y-m-d H:i:s'),
        'total_amount' => $s['invoice_value'], 'seller_name' => $s['from_name'], 'seller_add' => $s['from_address'], 'quantity' => 1,
        'shipment_width' => $s['breadth'], 'shipment_height' => $s['height'], 'shipment_length' => $s['length'], 'weight' => $s['weight'] * 1000,
        'shipping_mode' => $s['service'] === 'express' ? 'Express' : 'Surface', 'hsn_code' => (string) ($s['hsn'] ?? ''), 'waybill' => '', 'ewbn' => (string) ($s['ewaybill_no'] ?? ''),
    ]], 'pickup_location' => ['name' => $pickupName]];
    $r = delhivery_http('POST', '/api/cmu/create.json', 'format=json&data=' . urlencode(json_encode($data)), true, 'Create shipment (CMU)', 'Order #' . $s['order_no']);
    $pkg = $r['packages'][0] ?? null;
    if ($pkg && !empty($pkg['waybill']) && ($pkg['status'] ?? '') !== 'Fail') return ['ok' => true, 'awb' => (string) $pkg['waybill']];
    return ['ok' => false, 'error' => $pkg['remarks'][0] ?? ($r['rmk'] ?? 'Delhivery could not create the shipment')];
}

function delhivery_track(array $awbs): array {
    if (!delhivery_live() || !$awbs) return [];
    $r = delhivery_http('GET', '/api/v1/packages/json/', ['waybill' => implode(',', $awbs)], false, 'Tracking sync (bulk)', count($awbs) . ' AWBs');
    $out = [];
    foreach ($r['ShipmentData'] ?? [] as $row) {
        $sh = $row['Shipment'] ?? [];
        $out[$sh['AWB'] ?? ''] = $sh;
    }
    return $out;
}

/** Map Delhivery status to portal status */
function map_delhivery_status(array $st): ?string {
    $type = strtoupper($st['StatusType'] ?? ''); $s = strtolower($st['Status'] ?? '');
    if ($type === 'DL' && str_contains($s, 'rto')) return 'rto_delivered';
    if ($type === 'DL') return 'delivered';
    if ($type === 'RT') return 'rto_in_transit';
    if (str_contains($s, 'dispatched')) return 'out_for_delivery';
    if (str_contains($s, 'pending') && str_contains($s, 'pickup')) return 'pickup_pending';
    if ($type === 'UD' && (str_contains($s, 'manifest') || str_contains($s, 'not picked'))) return 'pickup_pending';
    if ($type === 'UD' && str_contains($s, 'pending')) return 'ndr';
    if ($type === 'UD' || $type === 'PU') return 'in_transit';
    return null;
}

function apply_status(array $s, string $new, string $label, string $location = '', string $remark = '', ?string $time = null): void {
    if ($s['status'] === $new && $label === '') return;
    $upd = ['status' => $new];
    if ($new === 'delivered') { $upd['delivered_at'] = $time ?? date('Y-m-d H:i:s'); if ($s['payment_mode'] === 'cod' && $s['cod_status'] === 'na') $upd['cod_status'] = 'pending'; }
    if ($new === 'ndr') { $upd['ndr_attempts'] = (int)$s['ndr_attempts'] + 1; $upd['ndr_reason'] = $remark ?: ($s['ndr_reason'] ?: 'Delivery attempt failed'); $upd['ndr_action'] = null; }
    update('shipments', $upd, 'id=?', [$s['id']]);
    add_event((int)$s['id'], $new, $label ?: (STATUS_LABEL[$new] ?? $new), $location, $remark, $time);
    if (in_array($new, ['rto_in_transit', 'rto_delivered']) && !$s['rto_charged']) {
        $amt = round($s['freight'] * (float) setting('rto_pct', 100) / 100, 2);
        if ($amt > 0) {
            $gst = round($amt * (float) setting('gst_pct', 18) / 100, 2);
            wallet_txn((int)$s['user_id'], 'debit', $amt + $gst, 'RTO charges …' . substr((string)$s['awb'], -4), $s['awb'], 'rto');
            update('shipments', ['rto_charged' => 1, 'rto_charge' => $amt + $gst], 'id=?', [$s['id']]);
        }
    }
}

function delhivery_sync(?array $ids = null): array {
    $n = b2b_sync();
    if (shipmozo_on()) {
        foreach (all("SELECT * FROM shipments WHERE provider='shipmozo' AND status NOT IN ('delivered','rto_delivered','cancelled') AND awb IS NOT NULL LIMIT 200") as $s) {
            $d = shipmozo_track((string) $s['awb']); if (!$d) continue;
            $st = (string) sm_pick($d, ['current_status', 'status', 'shipment_status'], '');
            $new = map_shipmozo_status($st);
            if ($new && $new !== $s['status']) { apply_status($s, $new, $st, (string) sm_pick($d, ['current_location', 'location'], ''), ''); $n++; }
        }
    }
    if (!delhivery_live()) { api_log('Tracking sync (bulk)', 'Delhivery simulation — nothing to pull', 'success'); return ['synced' => $n, 'note' => ($n ? "$n Shipmozo shipment(s) updated. " : '') . 'Delhivery is in simulation mode: update its statuses manually, or switch Delhivery to live.']; }
    $where = "provider='delhivery' AND status NOT IN ('delivered','rto_delivered','cancelled') AND awb IS NOT NULL";
    $rows = all("SELECT * FROM shipments WHERE $where" . ($ids ? ' AND id IN (' . implode(',', array_map('intval', $ids)) . ')' : '') . " LIMIT 500");
    foreach (array_chunk($rows, 50) as $chunk) {
        $data = delhivery_track(array_column($chunk, 'awb'));
        foreach ($chunk as $s) {
            $sh = $data[$s['awb']] ?? null; if (!$sh) continue;
            $st = $sh['Status'] ?? [];
            $new = map_delhivery_status($st);
            if ($new && $new !== $s['status']) { apply_status($s, $new, $st['Status'] ?? '', $st['StatusLocation'] ?? '', $st['Instructions'] ?? '', isset($st['StatusDateTime']) ? date('Y-m-d H:i:s', strtotime($st['StatusDateTime'])) : null); $n++; }
        }
    }
    return ['synced' => $n];
}

function delhivery_register_pickup(array $p): bool {
    if (!delhivery_live()) { update('pickup_addresses', ['delhivery_status' => 'registered', 'delhivery_name' => $p['name']], 'id=?', [$p['id']]); return true; }
    $r = delhivery_http('POST', '/api/backend/clientwarehouse/create/', ['name' => $p['name'], 'email' => '', 'phone' => $p['phone'], 'address' => $p['address'],
        'city' => $p['city'], 'country' => 'India', 'pin' => $p['pincode'], 'return_address' => $p['address'], 'return_pin' => $p['pincode'],
        'return_city' => $p['city'], 'return_state' => $p['state'], 'return_country' => 'India'], false, 'Register pickup location', $p['name']);
    $ok = is_array($r) && ($r['success'] ?? false);
    update('pickup_addresses', ['delhivery_status' => $ok ? 'registered' : 'failed', 'delhivery_name' => $p['name']], 'id=?', [$p['id']]);
    return $ok;
}

function delhivery_pickup_request(string $pickupName, string $date, int $count): bool {
    if (!delhivery_live()) { api_log('Pickup request', "$pickupName · $count pcs (simulation)", 'success'); return true; }
    $r = delhivery_http('POST', '/fm/request/new/', ['pickup_time' => '14:00:00', 'pickup_date' => $date, 'pickup_location' => $pickupName, 'expected_package_count' => $count],
        false, 'Pickup request', "$pickupName · $count pcs");
    return $r !== null;
}

function delhivery_cancel(string $awb): bool {
    if (!delhivery_live()) { api_log('Cancel shipment', "$awb (simulation)", 'success'); return true; }
    return delhivery_http('POST', '/api/p/edit', ['waybill' => $awb, 'cancellation' => 'true'], false, 'Cancel shipment', $awb) !== null;
}

function delhivery_ndr(string $awb, string $act): bool {
    if (!delhivery_live()) { api_log('NDR action', "$awb · $act (simulation)", 'success'); return true; }
    return delhivery_http('POST', '/api/p/update', ['data' => [['waybill' => $awb, 'act' => $act]]], false, 'NDR action', "$awb · $act") !== null;
}

function delhivery_label_pdf(string $awb): ?string {
    if (!delhivery_live()) return null;
    $r = delhivery_http('GET', '/api/p/packing_slip', ['wbns' => $awb, 'pdf' => 'true'], false, 'Packing slip / label', $awb);
    return $r['packages'][0]['pdf_download_link'] ?? null;
}

function delhivery_test(): array {
    if (setting('delhivery_token') === '') return ['ok' => false, 'message' => 'Add your Delhivery API token first.'];
    $r = delhivery_http('GET', '/c/api/pin-codes/json/', ['filter_codes' => '110001'], false, 'Test connection', '110001');
    return $r !== null ? ['ok' => true, 'message' => 'Connected to Delhivery (' . setting('delhivery_env') . ')'] : ['ok' => false, 'message' => 'Delhivery rejected the token or is unreachable. Check token & environment.'];
}
