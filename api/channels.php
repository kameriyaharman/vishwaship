<?php
// Store connectors: Shopify, WooCommerce and any custom website.
//  • Shopify     : store domain + Admin API access token (custom app, scopes read_orders, write_fulfillments, read_fulfillments)
//  • WooCommerce : store URL + REST consumer key / secret (read/write)
//  • Custom site : your API key (X-Api-Key) to push orders + optional webhook URL that receives status updates
// Imported orders arrive as drafts (Orders → Drafts / OMS); after booking, AWB + tracking is pushed back to the store.

function ch_creds(array $c): array { return json_decode((string) $c['credentials'], true) ?: []; }
function ch_settings(array $c): array { return (json_decode((string) ($c['settings'] ?? ''), true) ?: []) + ['auto_import' => 1, 'push_tracking' => 1, 'complete_order' => 0]; }

function ch_http(string $method, string $url, array $headers, $body, string $api, string $label, ?string $basic = null): array {
    $ch = curl_init($url);
    $h = array_merge(['Accept: application/json'], $headers);
    if ($body !== null) $h[] = 'Content-Type: application/json';
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $h, CURLOPT_FOLLOWLOCATION => false]);
    if ($basic) curl_setopt($ch, CURLOPT_USERPWD, $basic);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $ok = !$err && $code >= 200 && $code < 300;
    $j = json_decode((string) $res, true);
    api_log($api, mb_substr($label, 0, 120), $ok ? 'success' : 'failed', $err ?: mb_substr((string) $res, 0, 1500));
    $msg = is_array($j) ? ($j['errors'] ?? $j['message'] ?? $j['error'] ?? '') : '';
    if (is_array($msg)) $msg = json_encode($msg);
    return ['ok' => $ok, 'code' => $code, 'json' => is_array($j) ? $j : null, 'error' => $err ?: ((string) $msg ?: 'HTTP ' . $code)];
}

// ---------- Shopify ----------
const SHOPIFY_VER = '2024-10';
function shopify_domain(string $s): string {
    $s = strtolower(trim(preg_replace('#^https?://#i', '', $s), '/ '));
    $s = preg_replace('#/.*$#', '', $s);
    if ($s !== '' && !str_contains($s, '.')) $s .= '.myshopify.com';
    return $s;
}
function shopify_call(array $c, string $method, string $path, $body = null): array {
    $dom = shopify_domain($c['store_url']);
    return ch_http($method, "https://$dom/admin/api/" . SHOPIFY_VER . '/' . ltrim($path, '/'), ['X-Shopify-Access-Token: ' . (ch_creds($c)['token'] ?? '')], $body, 'Shopify', $dom . ' ' . $path);
}
function shopify_test(array $c): array {
    $r = shopify_call($c, 'GET', 'shop.json');
    return $r['ok'] ? ['ok' => true, 'name' => $r['json']['shop']['name'] ?? shopify_domain($c['store_url'])] : ['ok' => false, 'error' => $r['code'] === 401 ? 'Access token not accepted' : $r['error']];
}
function shopify_orders(array $c): array {
    $r = shopify_call($c, 'GET', 'orders.json?status=open&fulfillment_status=unfulfilled&limit=100&fields=id,name,email,phone,total_price,current_total_price,financial_status,payment_gateway_names,shipping_address,line_items,total_weight,note');
    if (!$r['ok']) throw new RuntimeException('Shopify: ' . $r['error']);
    $out = [];
    foreach ($r['json']['orders'] ?? [] as $o) {
        $a = $o['shipping_address'] ?? []; if (!$a) continue;
        $gw = strtolower(implode(' ', (array) ($o['payment_gateway_names'] ?? [])));
        $cod = ($o['financial_status'] ?? '') === 'pending' && (str_contains($gw, 'cash') || str_contains($gw, 'cod'));
        $total = (float) ($o['current_total_price'] ?? $o['total_price'] ?? 0);
        $items = array_map(fn($li) => $li['title'] . ' ×' . $li['quantity'], $o['line_items'] ?? []);
        $out[] = ['id' => (string) $o['id'], 'ref' => (string) $o['name'], 'to_name' => trim(($a['name'] ?? '') ?: (($a['first_name'] ?? '') . ' ' . ($a['last_name'] ?? ''))),
            'to_phone' => $a['phone'] ?? ($o['phone'] ?? ''), 'to_address' => trim(($a['address1'] ?? '') . ' ' . ($a['address2'] ?? '')), 'to_city' => $a['city'] ?? '',
            'to_state' => $a['province'] ?? '', 'to_pincode' => preg_replace('/\D/', '', (string) ($a['zip'] ?? '')), 'product' => mb_substr(implode(', ', $items), 0, 190),
            'invoice_value' => $total, 'payment_mode' => $cod ? 'cod' : 'prepaid', 'cod_amount' => $cod ? $total : 0, 'weight' => max(0.1, ((float) ($o['total_weight'] ?? 0)) / 1000)];
    }
    return $out;
}
function shopify_fulfill(array $c, array $s, string $trackUrl): array {
    $fo = shopify_call($c, 'GET', "orders/{$s['channel_order_id']}/fulfillment_orders.json");
    if (!$fo['ok']) return ['ok' => false, 'error' => $fo['error']];
    $ids = [];
    foreach ($fo['json']['fulfillment_orders'] ?? [] as $f) if (in_array($f['status'] ?? '', ['open', 'in_progress', 'scheduled'], true)) $ids[] = ['fulfillment_order_id' => $f['id']];
    if (!$ids) return ['ok' => true, 'note' => 'already fulfilled'];
    $r = shopify_call($c, 'POST', 'fulfillments.json', ['fulfillment' => ['line_items_by_fulfillment_order' => $ids, 'notify_customer' => true,
        'tracking_info' => ['number' => $s['awb'], 'company' => $s['courier_name'] ?: 'Vishwaship', 'url' => $trackUrl]]]);
    return ['ok' => $r['ok'], 'error' => $r['error']];
}

// ---------- WooCommerce ----------
function woo_base(array $c): string { return rtrim(preg_match('#^https?://#i', $c['store_url']) ? $c['store_url'] : 'https://' . $c['store_url'], '/') . '/wp-json/wc/v3/'; }
function woo_call(array $c, string $method, string $path, $body = null): array {
    $k = ch_creds($c);
    return ch_http($method, woo_base($c) . ltrim($path, '/'), [], $body, 'WooCommerce', parse_url(woo_base($c), PHP_URL_HOST) . ' ' . $path, ($k['key'] ?? '') . ':' . ($k['secret'] ?? ''));
}
function woo_test(array $c): array {
    if (!preg_match('#^https://#i', woo_base($c))) return ['ok' => false, 'error' => 'Store must use https://'];
    $r = woo_call($c, 'GET', 'orders?per_page=1');
    return $r['ok'] ? ['ok' => true, 'name' => parse_url(woo_base($c), PHP_URL_HOST)] : ['ok' => false, 'error' => in_array($r['code'], [401, 403], true) ? 'Consumer key / secret not accepted (needs Read/Write)' : $r['error']];
}
function woo_orders(array $c): array {
    $r = woo_call($c, 'GET', 'orders?status=processing&per_page=100');
    if (!$r['ok']) throw new RuntimeException('WooCommerce: ' . $r['error']);
    $out = [];
    foreach ($r['json'] ?? [] as $o) {
        $a = !empty($o['shipping']['address_1']) ? $o['shipping'] : ($o['billing'] ?? []);
        $cod = ($o['payment_method'] ?? '') === 'cod';
        $w = 0; foreach ($o['line_items'] ?? [] as $li) $w += (float) ($li['weight'] ?? 0) * (int) ($li['quantity'] ?? 1);
        $out[] = ['id' => (string) $o['id'], 'ref' => '#' . ($o['number'] ?? $o['id']), 'to_name' => trim(($a['first_name'] ?? '') . ' ' . ($a['last_name'] ?? '')),
            'to_phone' => ($o['shipping']['phone'] ?? '') ?: ($o['billing']['phone'] ?? ''), 'to_address' => trim(($a['address_1'] ?? '') . ' ' . ($a['address_2'] ?? '')),
            'to_city' => $a['city'] ?? '', 'to_state' => $a['state'] ?? '', 'to_pincode' => preg_replace('/\D/', '', (string) ($a['postcode'] ?? '')),
            'product' => mb_substr(implode(', ', array_map(fn($li) => $li['name'] . ' ×' . $li['quantity'], $o['line_items'] ?? [])), 0, 190),
            'invoice_value' => (float) ($o['total'] ?? 0), 'payment_mode' => $cod ? 'cod' : 'prepaid', 'cod_amount' => $cod ? (float) $o['total'] : 0, 'weight' => max(0.1, $w)];
    }
    return $out;
}
function woo_fulfill(array $c, array $s, string $trackUrl): array {
    $r = woo_call($c, 'POST', "orders/{$s['channel_order_id']}/notes", ['note' => "Shipped with {$s['courier_name']}. AWB {$s['awb']}. Track: $trackUrl", 'customer_note' => true]);
    if ($r['ok'] && !empty(ch_settings($c)['complete_order'])) woo_call($c, 'PUT', "orders/{$s['channel_order_id']}", ['status' => 'completed']);
    return ['ok' => $r['ok'], 'error' => $r['error']];
}

// ---------- import / push ----------
/** import open orders as drafts; returns number of new drafts */
function channel_sync(array $c): int {
    $orders = $c['type'] === 'shopify' ? shopify_orders($c) : ($c['type'] === 'woocommerce' ? woo_orders($c) : []);
    $pickup = one("SELECT * FROM pickup_addresses WHERE user_id=? ORDER BY is_default DESC, id LIMIT 1", [$c['user_id']]);
    $n = 0;
    foreach ($orders as $o) {
        if (val("SELECT id FROM shipments WHERE channel_id=? AND channel_order_id=?", [$c['id'], $o['id']])) continue;
        $d = ['user_id' => $c['user_id'], 'pickup_id' => $pickup['id'] ?? null, 'order_no' => next_order_no(), 'is_draft' => 1, 'status' => 'draft',
            'channel_id' => $c['id'], 'channel_order_id' => $o['id'], 'order_ref' => mb_substr($o['ref'], 0, 60),
            'to_name' => mb_substr($o['to_name'], 0, 120), 'to_phone' => substr(preg_replace('/\D/', '', (string) $o['to_phone']), -10), 'to_address' => mb_substr($o['to_address'], 0, 250),
            'to_city' => $o['to_city'], 'to_state' => $o['to_state'], 'to_pincode' => substr($o['to_pincode'], 0, 6), 'product' => $o['product'], 'invoice_value' => $o['invoice_value'],
            'payment_mode' => $o['payment_mode'], 'cod_amount' => $o['cod_amount'], 'weight' => round($o['weight'], 3), 'length' => 0, 'breadth' => 0, 'height' => 0, 'service' => 'surface'];
        if ($pickup) $d += ['from_name' => $pickup['name'], 'from_contact' => $pickup['contact'], 'from_phone' => $pickup['phone'], 'from_address' => $pickup['address'], 'from_city' => $pickup['city'], 'from_state' => $pickup['state'], 'from_pincode' => $pickup['pincode']];
        insert('shipments', $d); $n++;
    }
    update('channels', ['last_sync' => date('Y-m-d H:i:s'), 'last_error' => null, 'status' => 'connected', 'imported' => (int) $c['imported'] + $n], 'id=?', [$c['id']]);
    return $n;
}

/** after booking a channel order: push AWB + tracking back to the store (runs after the response) */
function channel_push_tracking(int $shipmentId): void {
    notify_later(function () use ($shipmentId) {
        $s = one("SELECT * FROM shipments WHERE id=?", [$shipmentId]);
        if (!$s || !$s['channel_id'] || !$s['channel_order_id'] || str_starts_with((string) $s['awb'], 'PENDING-')) return;
        $c = one("SELECT * FROM channels WHERE id=?", [$s['channel_id']]);
        if (!$c || empty(ch_settings($c)['push_tracking'])) return;
        $url = notif_vars_shipment($s)['track_url'];
        $r = $c['type'] === 'shopify' ? shopify_fulfill($c, $s, $url) : ($c['type'] === 'woocommerce' ? woo_fulfill($c, $s, $url) : ['ok' => true]);
        add_event((int) $s['id'], $s['status'], $r['ok'] ? 'Tracking sent to ' . ucfirst($c['type']) . ' store' : 'Could not update ' . ucfirst($c['type']) . ' order', '', $r['ok'] ? '' : (string) ($r['error'] ?? ''));
    });
}

/** custom websites: POST status updates to the seller's webhook URL */
function channel_webhooks(array $s, string $status): void {
    $hooks = all("SELECT * FROM channels WHERE user_id=? AND type='custom' AND status='connected'", [$s['user_id']]);
    foreach ($hooks as $c) {
        $url = (string) (ch_settings($c)['webhook_url'] ?? '');
        if (!preg_match('#^https://#i', $url)) continue;
        notify_later(function () use ($c, $url, $s, $status) {
            $body = ['event' => 'shipment.status', 'awb' => $s['awb'], 'order_no' => $s['order_no'], 'order_ref' => $s['order_ref'], 'status' => $status,
                'status_label' => STATUS_LABEL[$status] ?? $status, 'courier' => $s['courier_name'], 'time' => date('c')];
            $sig = hash_hmac('sha256', json_encode($body), (string) (ch_creds($c)['webhook_secret'] ?? ''));
            ch_http('POST', $url, ['X-Vishwaship-Signature: ' . $sig], $body, 'Webhook', $url);
        });
    }
}
