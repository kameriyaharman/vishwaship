<?php
// Per-service pricing: each service is priced either from the courier API (+ commission %) or from the
// admin's own rate card (zone × weight). Extra per-shipment charges (first mile, other) are added on top,
// and customers always see the GST-inclusive total with a breakdown.

/** built-in services; carriers added in admin become 'carrier_{id}' (rate card only) */
function svc_catalog(): array {
    return [
        'shipmozo_b2c' => ['label' => 'Shipmozo B2C', 'kind' => 'b2c', 'cards' => ['sm_b2c' => 'All Shipmozo B2C couriers']],
        'shipmozo_b2b' => ['label' => 'Shipmozo B2B', 'kind' => 'b2b', 'cards' => ['sm_b2b' => 'All Shipmozo B2B couriers']],
        'delhivery_b2c' => ['label' => 'Delhivery B2C', 'kind' => 'b2c', 'cards' => ['surface' => 'Delhivery Surface', 'express' => 'Delhivery Express (Air)']],
        'delhivery_b2b' => ['label' => 'Delhivery B2B (Cargo)', 'kind' => 'b2b', 'cards' => ['dlv_b2b' => 'Delhivery Cargo']],
    ];
}

function svc_pricing(string $key): array {
    static $c = [];
    if (isset($c[$key])) return $c[$key];
    $r = one("SELECT * FROM service_pricing WHERE service_key=?", [$key]) ?: [];
    return $c[$key] = [
        'service_key' => $key, 'enabled' => (int) ($r['enabled'] ?? 1), 'mode' => ($r['mode'] ?? 'api') === 'card' ? 'card' : 'api',
        'markup_pct' => isset($r['markup_pct']) && $r['markup_pct'] !== null && $r['markup_pct'] !== '' ? (float) $r['markup_pct'] : null,
        'first_mile' => (float) ($r['first_mile'] ?? 0), 'other_charges' => (float) ($r['other_charges'] ?? 0), 'other_label' => $r['other_label'] ?? 'Other charges',
        'min_kg' => (float) ($r['min_kg'] ?? 0),
    ];
}

/** selling price from a rate card: base price covers base_kg, then step_price per step_kg (rounded up) */
function card_price(string $cardKey, string $zone, float $kg): ?float {
    $r = one("SELECT * FROM rate_card WHERE service=? AND zone=?", [$cardKey, $zone]);
    if (!$r || (float) $r['first_500'] <= 0) return null;
    $baseKg = (float) ($r['base_kg'] ?? 0.5) ?: 0.5;
    $stepKg = (float) ($r['step_kg'] ?? 0.5) ?: 0.5;
    $extra = max(0, ceil(round(($kg - $baseKg) / $stepKg, 4)));
    return round((float) $r['first_500'] + $extra * (float) $r['add_500'], 2);
}

/**
 * Build one priced option.
 * $apiBase: courier cost from the API (null if unknown); $apiIncludesCod: the API price already contains COD charges.
 * Returns null when the service cannot be priced (no API rate in API mode / no rate card in card mode).
 */
function price_option(string $svcKey, ?float $apiBase, string $cardKey, string $zone, float $kg, ?array $user, string $payment, float $codAmount, bool $apiIncludesCod): ?array {
    $p = svc_pricing($svcKey);
    $gstPct = (float) setting('gst_pct', 18);
    $kgSvc = max($kg, $p['min_kg']);
    if ($p['mode'] === 'card') {
        $card = card_price($cardKey, $zone, $kgSvc);
        if ($card === null) return null;
        $shipping = round_price($card);
        $codIncluded = false;
    } else {
        if ($apiBase === null || $apiBase <= 0) return null;
        $markup = ($user && $user['markup_pct'] !== null && $user['markup_pct'] !== '') ? (float) $user['markup_pct'] : ($p['markup_pct'] ?? (float) setting('global_markup', 20));
        $shipping = apply_markup($apiBase, $markup);
        $codIncluded = $apiIncludesCod;
    }
    $codBase = 0; $cod = 0;
    if ($payment === 'cod' && !$codIncluded) {
        $codBase = max((float) setting('cod_fixed', 30), $codAmount * (float) setting('cod_pct', 1.5) / 100);
        $cod = round_price($codBase);
    }
    $fm = round($p['first_mile'], 2); $oth = round($p['other_charges'], 2);
    $freight = round($shipping + $fm + $oth, 2);
    $gst = round(($freight + $cod) * $gstPct / 100, 2);
    return [
        'svc_key' => $svcKey, 'pricing' => $p['mode'], 'base' => $apiBase !== null ? round($apiBase, 2) : null, 'cod_base' => $codBase,
        'shipping' => $shipping, 'first_mile' => $fm, 'other_charges' => $oth, 'other_label' => $p['other_label'],
        'freight' => $freight, 'cod_charge' => $cod, 'cod_included' => $codIncluded && $payment === 'cod',
        'gst' => $gst, 'gst_pct' => $gstPct, 'total' => round($freight + $cod + $gst, 2),
    ];
}

/** logo for a courier name (works for couriers that come through Shipmozo too) */
function courier_logo(string $name, ?int $carrierLogoFileId = null): ?string {
    if ($carrierLogoFileId) return 'carrier:' . $carrierLogoFileId; // frontend → {API}/public/carrier-logo/{id}
    $n = strtolower($name);
    $map = [
        'delhivery' => 'delhivery', 'xpressbees' => 'xpressbees', 'xpress bees' => 'xpressbees', 'ekart' => 'ekart', 'blue dart' => 'blue-dart', 'bluedart' => 'blue-dart',
        'dtdc' => 'dtdc', 'amazon' => 'amazon-shipping', 'ats' => 'amazon-shipping', 'shadowfax' => 'shadowfax', 'ecom' => 'ecom-express', 'dhl' => 'dhl', 'fedex' => 'fedex-express',
        'india post' => 'india-post', 'speed post' => 'india-post', 'aramex' => 'aramex', 'ups' => 'ups', 'gati' => 'allcargo-gati', 'tci express' => 'tci-express', 'tci' => 'tci',
        'trackon' => 'trackon', 'professional' => 'the-professional-couriers', 'maruti' => 'shree-maruti', 'dp world' => 'dp-world', 'porter' => 'porter', 'borzo' => 'borzo', 'allcargo' => 'allcargo-logistics',
    ];
    foreach ($map as $k => $f) if (preg_match('/\b' . preg_quote($k, '/') . '/', $n)) return '/couriers/' . $f . '.webp';
    return null;
}

/** carriers added in admin with their own rate card (booked manually — admin enters the AWB) */
function manual_carriers(string $kind): array {
    $out = [];
    foreach (all("SELECT * FROM carriers WHERE enabled=1") as $c) {
        $m = strtolower((string) $c['modes']);
        if ($kind === 'b2b' ? !str_contains($m, 'b2b') : !str_contains($m, 'b2c')) continue;
        $out[] = $c;
    }
    return $out;
}
