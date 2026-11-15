<?php
// Outgoing notifications — all keys are entered in Admin → Integrations.
//  • Email   : Resend   (https://api.resend.com/emails)
//  • SMS     : Way2SMS  (sendCampaign API, DLT template per event)
//  • WhatsApp: WATI     (approved template per event)
// Seller (customer) emails are free. Buyer SMS / WhatsApp follow the seller's Shipping Notification settings
// and use 1 notification credit each. Messages are sent after the API response is returned.

const NOTIFY_EVENTS = [
    'booked' => 'Shipment booked', 'picked_up' => 'Picked up', 'out_for_delivery' => 'Out for delivery', 'delivered' => 'Delivered',
    'ndr' => 'Delivery attempt failed (NDR)', 'rto_in_transit' => 'Returning to origin (RTO)',
    'wallet_recharge' => 'Wallet recharged', 'low_wallet' => 'Low wallet balance', 'ticket_reply' => 'Support ticket reply', 'kyc_update' => 'KYC status update',
];
const BUYER_EVENTS = ['booked', 'picked_up', 'out_for_delivery', 'delivered', 'ndr'];

function notif_defaults(): array {
    return [
        'booked' => ['email' => 1, 'sms' => 1, 'wa' => 1, 'subject' => 'Shipment booked · AWB {awb}', 'text' => 'Hi {name}, your order {order_no} from {seller} is booked with {courier}. AWB {awb}. Track: {track_url} - Vishwaship'],
        'picked_up' => ['email' => 0, 'sms' => 0, 'wa' => 1, 'subject' => 'Picked up · AWB {awb}', 'text' => 'Hi {name}, your order {order_no} has been picked up by {courier}. Track: {track_url} - Vishwaship'],
        'out_for_delivery' => ['email' => 0, 'sms' => 1, 'wa' => 1, 'subject' => 'Out for delivery · AWB {awb}', 'text' => 'Hi {name}, your order {order_no} is out for delivery today with {courier}. Track: {track_url} - Vishwaship'],
        'delivered' => ['email' => 1, 'sms' => 1, 'wa' => 1, 'subject' => 'Delivered · AWB {awb}', 'text' => 'Hi {name}, your order {order_no} has been delivered. Thank you for shopping with {seller}. - Vishwaship'],
        'ndr' => ['email' => 1, 'sms' => 1, 'wa' => 1, 'subject' => 'Delivery attempt failed · AWB {awb}', 'text' => 'Hi {name}, we could not deliver order {order_no} today ({reason}). Reply or call {support} to reschedule. - Vishwaship'],
        'rto_in_transit' => ['email' => 1, 'sms' => 0, 'wa' => 0, 'subject' => 'RTO initiated · AWB {awb}', 'text' => 'Shipment {awb} (order {order_no}) is returning to origin. - Vishwaship'],
        'wallet_recharge' => ['email' => 1, 'sms' => 0, 'wa' => 0, 'subject' => 'Wallet recharged · ₹{amount}', 'text' => 'Hi {name}, ₹{amount} has been added to your Vishwaship wallet. Balance: ₹{balance}.'],
        'low_wallet' => ['email' => 1, 'sms' => 0, 'wa' => 0, 'subject' => 'Low wallet balance', 'text' => 'Hi {name}, your Vishwaship wallet balance is ₹{balance}. Recharge to keep shipping without delay.'],
        'ticket_reply' => ['email' => 1, 'sms' => 0, 'wa' => 0, 'subject' => 'New reply on ticket {ticket_no}', 'text' => 'Hi {name}, our support team replied on ticket {ticket_no}: {message}'],
        'kyc_update' => ['email' => 1, 'sms' => 0, 'wa' => 0, 'subject' => 'KYC {status}', 'text' => 'Hi {name}, your KYC is {status}. {message}'],
    ];
}

/** admin config: per event channel switches, texts, DLT ids, WATI template names */
function notif_config(): array {
    $saved = json_decode((string) setting('notif_events', ''), true) ?: [];
    $out = [];
    foreach (notif_defaults() as $k => $d) $out[$k] = array_merge($d, ['dlt_id' => '', 'wa_template' => ''], (array) ($saved[$k] ?? []));
    return $out;
}

function notif_fill(string $t, array $v): string { return preg_replace_callback('/\{(\w+)\}/', fn($m) => (string) ($v[$m[1]] ?? ''), $t); }

function notif_http(string $url, string $method, array $headers, $body, string $api, string $to): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body));
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $ok = !$err && $code >= 200 && $code < 300;
    $j = json_decode((string) $res, true);
    if (is_array($j) && (($j['result'] ?? null) === false || ($j['status'] ?? '') === 'error')) $ok = false;
    if (function_exists('api_log')) api_log($api, mb_substr($to, 0, 80), $ok ? 'success' : 'failed', $err ?: mb_substr((string) $res, 0, 2000));
    return ['ok' => $ok, 'code' => $code, 'error' => $err ?: (is_array($j) ? (string) ($j['message'] ?? $j['info'] ?? '') : '') ?: ('HTTP ' . $code), 'json' => $j];
}

// ---- providers
function send_email(string $to, string $subject, string $text, ?string $html = null): array {
    if (setting('email_enabled') !== '1' || setting('resend_api_key') === '') return ['ok' => false, 'error' => 'Email (Resend) is not enabled'];
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'error' => 'Invalid email'];
    $brand = htmlspecialchars(setting('company_name', 'Vishwaship'));
    $html = $html ?? '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e6e9ef;border-radius:12px;overflow:hidden">'
        . '<div style="background:#0b1f3a;color:#fff;padding:16px 22px;font-size:18px;font-weight:700">vishwa<span style="color:#f0712c">ship</span>.com</div>'
        . '<div style="padding:22px;color:#1a2433;font-size:15px;line-height:1.6">' . nl2br(htmlspecialchars($text)) . '</div>'
        . '<div style="padding:12px 22px;background:#f5f6fa;color:#6b7183;font-size:12px">' . $brand . ' · ' . htmlspecialchars((string) (content()['contact_phone'] ?? '')) . '</div></div>';
    $body = ['from' => setting('resend_from', 'Vishwaship <noreply@vishwaship.com>'), 'to' => [$to], 'subject' => $subject, 'html' => $html, 'text' => $text];
    if (setting('email_reply_to')) $body['reply_to'] = setting('email_reply_to');
    return notif_http('https://api.resend.com/emails', 'POST', ['Authorization: Bearer ' . setting('resend_api_key'), 'Content-Type: application/json'], $body, 'Resend · email', $to);
}

function send_sms(string $phone, string $text, string $dltId = ''): array {
    if (setting('sms_enabled') !== '1' || setting('way2sms_api_key') === '') return ['ok' => false, 'error' => 'SMS (Way2SMS) is not enabled'];
    $phone = substr(preg_replace('/\D/', '', $phone), -10);
    if (strlen($phone) !== 10) return ['ok' => false, 'error' => 'Invalid mobile'];
    $f = ['apikey' => setting('way2sms_api_key'), 'secret' => setting('way2sms_secret'), 'usetype' => setting('way2sms_usetype', 'prod'), 'phone' => $phone,
        'message' => $text, 'senderid' => setting('way2sms_sender_id', '')];
    if ($dltId !== '') { $f['dltentityid'] = setting('way2sms_dlt_entity_id', ''); $f['dlttempid'] = $dltId; }
    return notif_http(setting('way2sms_url', 'https://www.way2sms.com/api/v1/sendCampaign'), 'POST', ['Content-Type: application/x-www-form-urlencoded'], http_build_query($f), 'Way2SMS · sms', $phone);
}

function send_whatsapp(string $phone, string $template, array $vars): array {
    if (setting('wa_enabled') !== '1' || setting('wati_token') === '' || setting('wati_endpoint') === '') return ['ok' => false, 'error' => 'WhatsApp (WATI) is not enabled'];
    if ($template === '') return ['ok' => false, 'error' => 'No WATI template set for this message'];
    $phone = preg_replace('/\D/', '', $phone); if (strlen($phone) === 10) $phone = '91' . $phone;
    $params = []; foreach ($vars as $k => $v) $params[] = ['name' => (string) $k, 'value' => (string) $v];
    $url = rtrim(setting('wati_endpoint'), '/') . '/api/v1/sendTemplateMessage?whatsappNumber=' . $phone;
    $tok = setting('wati_token'); if (!preg_match('/^Bearer /i', $tok)) $tok = 'Bearer ' . $tok;
    return notif_http($url, 'POST', ['Authorization: ' . $tok, 'Content-Type: application/json'], ['template_name' => $template, 'broadcast_name' => 'vs_' . $template . '_' . date('ymd'), 'parameters' => $params], 'WATI · whatsapp', $phone);
}

// ---- queue: work is done after the response is sent
function notify_later(callable $fn): void {
    static $q = null;
    if ($q === null) {
        $q = [];
        register_shutdown_function(function () use (&$q) {
            if (function_exists('litespeed_finish_request')) @litespeed_finish_request(); elseif (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
            foreach ($q as $f) { try { $f(); } catch (Throwable $e) { /* never break the request */ } }
        });
    }
    $q[] = $fn;
}

function notif_vars_shipment(array $s): array {
    $u = one("SELECT name, business_name, email FROM users WHERE id=?", [$s['user_id']]) ?: [];
    $base = rtrim(setting('site_url', ''), '/') ?: ((isset($_SERVER['HTTP_HOST']) ? 'https://' . $_SERVER['HTTP_HOST'] : 'https://vishwaship.com'));
    return ['name' => $s['to_name'], 'awb' => $s['awb'], 'order_no' => $s['order_ref'] ?: $s['order_no'], 'courier' => $s['courier_name'] ?: 'our courier partner',
        'seller' => $u['business_name'] ?: ($u['name'] ?? 'the seller'), 'track_url' => $base . '/track/?awb=' . rawurlencode((string) $s['awb']),
        'status' => STATUS_LABEL[$s['status']] ?? $s['status'], 'reason' => $s['ndr_reason'] ?? '', 'support' => (string) (content()['contact_phone'] ?? ''),
        'seller_name' => $u['name'] ?? '', 'seller_email' => $u['email'] ?? ''];
}

/** shipment event → seller email + buyer SMS / WhatsApp (per seller prefs, uses credits) */
function notify_shipment(array $s, string $event): void {
    $cfg = notif_config()[$event] ?? null;
    if (!$cfg || empty($s['awb']) || str_starts_with((string) $s['awb'], 'PENDING-')) return;
    notify_later(function () use ($s, $event, $cfg) {
        $v = notif_vars_shipment($s);
        // seller email
        if (!empty($cfg['email']) && in_array($event, ['booked', 'delivered', 'ndr', 'rto_in_transit'], true) && $v['seller_email']) {
            $txt = 'Hi ' . $v['seller_name'] . ",\n\n" . notif_fill($cfg['text'], array_merge($v, ['name' => $v['seller_name'] . ' (buyer: ' . $s['to_name'] . ')']));
            send_email($v['seller_email'], notif_fill($cfg['subject'], $v), $txt);
        }
        if (!in_array($event, BUYER_EVENTS, true)) return;
        $seller = one("SELECT id, notif_credits, prefs FROM users WHERE id=?", [$s['user_id']]);
        $np = (json_decode((string) ($seller['prefs'] ?? ''), true) ?: [])['notifications'] ?? ['sms' => false, 'whatsapp' => false, 'events' => ['booked' => true, 'out_for_delivery' => true, 'delivered' => true]];
        if (isset($np['events']) && empty($np['events'][$event])) return;
        $text = notif_fill($cfg['text'], $v);
        foreach ([['wa', 'whatsapp'], ['sms', 'sms']] as [$ch, $pref]) {
            if (empty($cfg[$ch]) || empty($np[$pref])) continue;
            $credits = (int) val("SELECT notif_credits FROM users WHERE id=?", [$s['user_id']]);
            if ($credits < 1) return;
            $r = $ch === 'wa' ? send_whatsapp((string) $s['to_phone'], (string) $cfg['wa_template'], array_intersect_key($v, array_flip(['name', 'awb', 'order_no', 'courier', 'seller', 'track_url', 'status', 'reason', 'support'])))
                              : send_sms((string) $s['to_phone'], $text, (string) $cfg['dlt_id']);
            if ($r['ok']) {
                q("UPDATE users SET notif_credits=notif_credits-1 WHERE id=? AND notif_credits>0", [$s['user_id']]);
                insert('notification_credits', ['user_id' => $s['user_id'], 'type' => 'debit', 'credits' => 1, 'balance_after' => $credits - 1,
                    'description' => ($ch === 'wa' ? 'WhatsApp' : 'SMS') . ' · ' . (NOTIFY_EVENTS[$event] ?? $event) . ' · ' . $s['awb']]);
            }
        }
    });
}

/** account event → seller email */
function notify_user(int $userId, string $event, array $vars = []): void {
    $cfg = notif_config()[$event] ?? null;
    if (!$cfg || empty($cfg['email'])) return;
    notify_later(function () use ($userId, $event, $cfg, $vars) {
        $u = one("SELECT name, email FROM users WHERE id=?", [$userId]); if (!$u || !$u['email']) return;
        $v = array_merge(['name' => $u['name']], $vars);
        send_email($u['email'], notif_fill($cfg['subject'], $v), notif_fill($cfg['text'], $v));
    });
}
