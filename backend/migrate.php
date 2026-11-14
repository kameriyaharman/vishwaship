<?php
// Creates tables (idempotent) and seeds defaults + demo data on first run.

function migrate(): void {
    $pdo = db();
    $stmts = [
"CREATE TABLE IF NOT EXISTS settings (k VARCHAR(100) PRIMARY KEY, v MEDIUMTEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('customer','admin','staff') NOT NULL DEFAULT 'customer',
  staff_role VARCHAR(50) NULL, permissions TEXT NULL,
  name VARCHAR(120) NOT NULL, business_name VARCHAR(160) NULL, city VARCHAR(80) NULL,
  mobile VARCHAR(20) NULL, email VARCHAR(160) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  gstin VARCHAR(20) NULL, pan VARCHAR(20) NULL, aadhaar VARCHAR(20) NULL, kyc_type VARCHAR(20) NULL, kyc_doc_id INT NULL,
  kyc_status ENUM('pending','submitted','verified','rejected') NOT NULL DEFAULT 'pending', kyc_note VARCHAR(255) NULL,
  monthly_volume VARCHAR(30) NULL, status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0, credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  markup_pct DECIMAL(5,2) NULL, markup_reason VARCHAR(120) NULL,
  cod_cycle VARCHAR(20) NOT NULL DEFAULT 'Weekly', bank_name VARCHAR(80) NULL, bank_account VARCHAR(40) NULL, bank_ifsc VARCHAR(20) NULL,
  is_demo TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS pickup_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, name VARCHAR(160) NOT NULL, contact VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL, address VARCHAR(255) NOT NULL, city VARCHAR(80) NOT NULL, state VARCHAR(80) NOT NULL,
  pincode VARCHAR(6) NOT NULL, is_default TINYINT NOT NULL DEFAULT 0,
  delhivery_status ENUM('pending','registered','failed') NOT NULL DEFAULT 'pending', delhivery_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS shipments (
  id INT AUTO_INCREMENT PRIMARY KEY, order_no VARCHAR(30) NOT NULL UNIQUE, awb VARCHAR(30) NULL, user_id INT NOT NULL, pickup_id INT NULL,
  from_name VARCHAR(160), from_contact VARCHAR(120), from_phone VARCHAR(20), from_address VARCHAR(255), from_city VARCHAR(80), from_state VARCHAR(80), from_pincode VARCHAR(6),
  to_name VARCHAR(120) NOT NULL, to_phone VARCHAR(20) NOT NULL, to_address VARCHAR(255) NOT NULL, to_city VARCHAR(80), to_state VARCHAR(80), to_pincode VARCHAR(6) NOT NULL,
  product VARCHAR(200), invoice_value DECIMAL(12,2) DEFAULT 0, payment_mode ENUM('prepaid','cod') NOT NULL DEFAULT 'prepaid', cod_amount DECIMAL(12,2) DEFAULT 0,
  weight DECIMAL(8,3) NOT NULL, length DECIMAL(8,2) DEFAULT 0, breadth DECIMAL(8,2) DEFAULT 0, height DECIMAL(8,2) DEFAULT 0,
  vol_weight DECIMAL(8,3) DEFAULT 0, chargeable_weight DECIMAL(8,3) DEFAULT 0, zone CHAR(1) NULL,
  service ENUM('surface','express') NOT NULL DEFAULT 'surface', markup_pct DECIMAL(5,2) DEFAULT 0,
  base_rate DECIMAL(10,2) DEFAULT 0, cod_base DECIMAL(10,2) DEFAULT 0, freight DECIMAL(10,2) DEFAULT 0, cod_charge DECIMAL(10,2) DEFAULT 0,
  gst DECIMAL(10,2) DEFAULT 0, total DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pickup_pending', wd_open TINYINT NOT NULL DEFAULT 0,
  pickup_date DATE NULL, pickup_slot VARCHAR(40) NULL, eta DATE NULL, delivered_at DATETIME NULL,
  courier_weight DECIMAL(8,3) NULL, ndr_attempts INT NOT NULL DEFAULT 0, ndr_reason VARCHAR(160) NULL, ndr_action VARCHAR(160) NULL,
  rto_charged TINYINT NOT NULL DEFAULT 0, rto_charge DECIMAL(10,2) DEFAULT 0,
  cod_status ENUM('na','pending','received','remitted') NOT NULL DEFAULT 'na', remittance_id INT NULL,
  label_url TEXT NULL, is_draft TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id), INDEX(awb), INDEX(status), INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS tracking_events (
  id INT AUTO_INCREMENT PRIMARY KEY, shipment_id INT NOT NULL, status VARCHAR(30), label VARCHAR(160), location VARCHAR(160), remark VARCHAR(255),
  event_time DATETIME NOT NULL, INDEX(shipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS wallet_txns (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, type ENUM('credit','debit') NOT NULL, amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL, description VARCHAR(255), ref VARCHAR(80), category VARCHAR(30),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS weight_disputes (
  id INT AUTO_INCREMENT PRIMARY KEY, shipment_id INT NOT NULL, user_id INT NOT NULL, awb VARCHAR(30),
  declared_weight DECIMAL(8,3), declared_dims VARCHAR(60), declared_vol DECIMAL(8,3),
  courier_weight DECIMAL(8,3), courier_dims VARCHAR(60), courier_vol DECIMAL(8,3), charged_weight DECIMAL(8,3),
  earlier_amount DECIMAL(10,2), revised_amount DECIMAL(10,2), base_extra DECIMAL(10,2), customer_extra DECIMAL(10,2), charged_amount DECIMAL(10,2) DEFAULT 0,
  status ENUM('open','disputed','accepted','resolved') NOT NULL DEFAULT 'open',
  customer_action VARCHAR(160) NULL, customer_note TEXT NULL, delhivery_dispute VARCHAR(120) NULL, outcome VARCHAR(20) NULL,
  proof_ids VARCHAR(120) NULL, proof_labels VARCHAR(255) NULL, customer_proof_ids VARCHAR(120) NULL,
  deadline DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME NULL, INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS cod_remittances (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, amount DECIMAL(12,2) NOT NULL, shipments INT NOT NULL DEFAULT 0,
  utr VARCHAR(60) NULL, status ENUM('pending','paid') NOT NULL DEFAULT 'paid', remit_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, number VARCHAR(40) NOT NULL UNIQUE, period VARCHAR(7) NOT NULL,
  shipments INT DEFAULT 0, taxable DECIMAL(12,2) DEFAULT 0, gst DECIMAL(12,2) DEFAULT 0, amount DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS rate_card (
  id INT AUTO_INCREMENT PRIMARY KEY, service VARCHAR(20) NOT NULL, zone CHAR(1) NOT NULL, first_500 DECIMAL(10,2) NOT NULL, add_500 DECIMAL(10,2) NOT NULL,
  UNIQUE KEY(service, zone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY, api VARCHAR(80), request VARCHAR(255), result VARCHAR(20), response TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, name VARCHAR(160), mime VARCHAR(80), data MEDIUMBLOB,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, shipment_id INT NULL, subject VARCHAR(200), message TEXT,
  status ENUM('open','closed') NOT NULL DEFAULT 'open', reply TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
"CREATE TABLE IF NOT EXISTS enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120), phone VARCHAR(20), email VARCHAR(160), message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
    foreach ($stmts as $s) $pdo->exec($s);

    if (!val("SELECT COUNT(*) FROM settings WHERE k='installed'")) seed_defaults();
}

function default_content(): array {
    return [
        'brand_name' => 'vishwaship', 'brand_suffix' => '.com',
        'hero_badge' => 'COURIER BOOKING FOR SELLERS & BUSINESSES',
        'hero_title_1' => 'Ship anywhere in India.', 'hero_title_2' => 'Book in 60 seconds.',
        'hero_sub' => 'Create your account, check the rate, book the shipment and get your AWB instantly. Track every parcel from one dashboard.',
        'stats' => [['v' => '₹28*', 'l' => 'starting rate / 500 g'], ['v' => 'COD', 'l' => 'available'], ['v' => '24×7', 'l' => 'tracking']],
        'features' => [
            ['icon' => 'rupee', 't' => 'See rate before booking', 'd' => 'Final price shown upfront — no hidden charges'],
            ['icon' => 'tag', 't' => 'Instant AWB & label', 'd' => 'Print label, schedule pickup in one click'],
            ['icon' => 'truck', 't' => '19,000+ pincodes*', 'd' => 'Powered by Delhivery network'],
            ['icon' => 'chart', 't' => 'Live dashboard', 'd' => 'In transit, delivered, RTO, weight issues'],
        ],
        'steps' => ['Sign up & KYC', 'Add wallet balance', 'Book & get AWB', 'Pickup & track'],
        'services' => [
            ['t' => 'Surface shipping', 'd' => 'Economical ground delivery across 19,000+ pincodes in 3–5 days.'],
            ['t' => 'Express (Air)', 'd' => 'Priority air delivery to metros and major cities in 1–2 days.'],
            ['t' => 'Cash on Delivery', 'd' => 'Collect payment at the doorstep, remitted to your bank weekly.'],
            ['t' => 'Reverse pickup', 'd' => 'Easy returns — schedule reverse pickups from your customers.'],
        ],
        'signup_title_1' => 'Your shipping,', 'signup_title_2' => 'one dashboard.',
        'signup_points' => ['Final rate before you book', 'AWB & label instantly', 'Live status: in transit, delivered, RTO', 'Weight discrepancy details with proof'],
        'contact_phone' => '+91 92208 92667', 'contact_email' => 'support@vishwaship.com', 'contact_address' => 'Dwarka, New Delhi, India',
        'whatsapp' => '919220892667',
        'footer_text' => '© ' . date('Y') . ' Vishwaship. All rights reserved.',
        'terms_text' => "1. Shipments are carried by Delhivery under its terms of carriage.\n2. Declared weight and dimensions must be accurate — re-weighed differences are charged as weight discrepancy.\n3. Prohibited and dangerous goods are not accepted.\n4. Wallet balance is non-refundable except on account closure.\n5. COD amounts are remitted as per the remittance cycle after delivery.",
    ];
}

function seed_defaults(): void {
    $defaults = [
        'global_markup' => '20', 'gst_pct' => '18', 'vol_divisor' => '5000', 'rounding' => 'ceil1',
        'cod_fixed' => '30', 'cod_pct' => '1.5', 'cod_rule_text' => 'Delhivery COD + markup',
        'rto_pct' => '100', 'rto_rule_text' => 'Same as forward + markup', 'wd_rule_text' => 'Pass on difference + markup',
        'auto_accept' => '1', 'auto_accept_days' => '7', 'require_kyc' => '0', 'min_recharge' => '500',
        'surface_days' => '3–5 days', 'surface_eta' => '4', 'express_days' => '1–2 days', 'express_eta' => '2',
        'service_surface_enabled' => '1', 'service_express_enabled' => '1',
        'pickup_slots' => json_encode(['10 AM – 2 PM', '2 PM – 6 PM']),
        'cod_next_remittance' => date('Y-m-d', strtotime('next friday')), 'low_wallet_threshold' => '500',
        'delhivery_env' => 'staging', 'delhivery_token' => '', 'delhivery_client' => 'VISHWASHIP SURFACE', 'delhivery_mode' => 'simulation',
        'delhivery_default_service' => 'surface', 'delhivery_sync_minutes' => '30',
        'payment_gateway' => 'test', 'razorpay_key_id' => '', 'razorpay_key_secret' => '',
        'invoice_prefix' => 'VS/INV/', 'company_name' => 'Vishwaship Logistics', 'company_gstin' => '', 'company_address' => 'Dwarka, New Delhi',
        'content' => json_encode(default_content(), JSON_UNESCAPED_UNICODE),
    ];
    foreach ($defaults as $k => $v) set_setting($k, $v);

    $rates = [
        'surface' => ['A' => [32, 28], 'B' => [38, 34], 'C' => [46, 40], 'D' => [58, 50], 'E' => [70, 62]],
        'express' => ['A' => [45, 40], 'B' => [60, 55], 'C' => [72, 64], 'D' => [92, 84], 'E' => [110, 98]],
    ];
    foreach ($rates as $svc => $zones) foreach ($zones as $z => [$f, $a])
        q("INSERT IGNORE INTO rate_card (service,zone,first_500,add_500) VALUES (?,?,?,?)", [$svc, $z, $f, $a]);

    $adminEmail = env('ADMIN_EMAIL', 'admin@vishwaship.com');
    $adminPass = env('ADMIN_PASSWORD', 'Admin@123');
    if (!val("SELECT id FROM users WHERE email=?", [$adminEmail]))
        insert('users', ['role' => 'admin', 'staff_role' => 'Super admin', 'name' => 'Vishwaship Admin', 'email' => $adminEmail,
            'password_hash' => password_hash($adminPass, PASSWORD_DEFAULT), 'kyc_status' => 'verified', 'permissions' => '[]']);

    if (env('SEED_DEMO', '1') === '1') seed_demo();
    set_setting('installed', date('c'));
}

function seed_demo(): void {
    mt_srand(42);
    $pw = password_hash('Demo@123', PASSWORD_DEFAULT);
    $customers = [
        ['Rahul Kumar', 'Kumar Traders', 'Delhi', '9811000010', 'rahul@kumartraders.in', '07AABCK1234A1Z5', 'GST', 'verified', null, null, 'active', '110034', 'Plot 22, Sector 3, Rohini', 'Delhi'],
        ['Neha Sharma', 'StyleKart (D2C)', 'Delhi', '9911000021', 'neha@stylekart.in', '07AACCS4321B1Z2', 'GST', 'verified', 15, 'High volume', 'active', '110020', 'B-14, Okhla Phase 1', 'Delhi'],
        ['Suresh Gupta', 'Om Pharma', 'Delhi', '9811000077', 'suresh@ompharma.in', '07AADCO5555C1Z9', 'GST', 'verified', 18, 'Contract', 'active', '110085', '45, Sector 7, Rohini', 'Delhi'],
        ['Ritu Verma', 'Gift Box Co.', 'Delhi', '9611000055', 'ritu@giftbox.co', null, 'PAN', 'verified', null, null, 'active', '110075', 'C-2, Sector 12, Dwarka', 'Delhi'],
        ['Amit Sharma', 'Sharma Handicrafts', 'Jaipur', '9311000009', 'amit@sharmahandicrafts.in', null, null, 'pending', null, null, 'active', '302001', 'Johari Bazaar', 'Rajasthan'],
        ['Vijay Singh', 'QuickBuy Store', 'Delhi', '9011000031', 'vijay@quickbuy.in', '07AAECQ7777D1Z1', 'GST', 'verified', 25, 'High RTO', 'blocked', '110092', 'Laxmi Nagar', 'Delhi'],
    ];
    $dests = [
        ['Sneha Patil', '411001', 'Pune', 'Maharashtra', 'Flat 304, Green Park Society, Camp'],
        ['Amit Joshi', '302001', 'Jaipur', 'Rajasthan', '12 MI Road'], ['Ravi Kumar', '800001', 'Patna', 'Bihar', 'Boring Road'],
        ['Ananya Das', '700016', 'Kolkata', 'West Bengal', '22 Park Street'], ['Vikas Mishra', '226001', 'Lucknow', 'Uttar Pradesh', 'Hazratganj'],
        ['Priya Nair', '400069', 'Mumbai', 'Maharashtra', 'Andheri East'], ['Karthik R', '600001', 'Chennai', 'Tamil Nadu', 'Parrys Corner'],
        ['Meera Iyer', '560001', 'Bengaluru', 'Karnataka', 'MG Road'], ['Rohit Jain', '452001', 'Indore', 'Madhya Pradesh', 'Vijay Nagar'],
        ['Pooja Singh', '201301', 'Noida', 'Uttar Pradesh', 'Sector 18'], ['Arjun Mehta', '380001', 'Ahmedabad', 'Gujarat', 'CG Road'],
        ['Deepak Bora', '781001', 'Guwahati', 'Assam', 'Pan Bazaar'],
    ];
    $products = ['Cotton kurta ×2', 'Phone case', 'Ayurvedic tablets', 'Gift hamper', 'Wooden decor', 'Bedsheet set', 'Sneakers', 'Books ×3'];
    $statuses = ['delivered', 'delivered', 'delivered', 'delivered', 'in_transit', 'in_transit', 'out_for_delivery', 'pickup_pending', 'rto_in_transit', 'ndr', 'delivered', 'picked_up'];
    $awb = 149081107400;
    foreach ($customers as $ci => $c) {
        $uid = insert('users', ['role' => 'customer', 'name' => $c[0], 'business_name' => $c[1], 'city' => $c[2], 'mobile' => $c[3], 'email' => $c[4],
            'password_hash' => $pw, 'gstin' => $c[5], 'kyc_type' => $c[6], 'kyc_status' => $c[7], 'markup_pct' => $c[8], 'markup_reason' => $c[9],
            'status' => $c[10], 'monthly_volume' => '100 – 500', 'bank_name' => 'HDFC', 'bank_account' => '50100' . (4521 + $ci), 'bank_ifsc' => 'HDFC0001234',
            'wallet_balance' => 0, 'is_demo' => 1, 'created_at' => date('Y-m-d H:i:s', strtotime('-' . (60 - $ci * 7) . ' days'))]);
        $pid = insert('pickup_addresses', ['user_id' => $uid, 'name' => $c[1] . ' — Warehouse 1', 'contact' => $c[0], 'phone' => $c[3], 'address' => $c[12],
            'city' => $c[2], 'state' => $c[13], 'pincode' => $c[11], 'is_default' => 1, 'delhivery_status' => $c[7] === 'verified' ? 'registered' : 'pending',
            'delhivery_name' => $c[1] . ' – WH1']);
        if ($c[7] !== 'verified') continue;
        $u = one("SELECT * FROM users WHERE id=?", [$uid]);
        wallet_txn($uid, 'credit', 25000, 'Wallet recharge · UPI', 'RCH' . $uid, 'recharge');
        $count = $ci === 0 ? 26 : 12;
        for ($i = 0; $i < $count; $i++) {
            $d = $dests[mt_rand(0, count($dests) - 1)];
            $w = [0.5, 0.5, 1.0, 1.2, 2.0, 3.5][mt_rand(0, 5)];
            $l = [20, 30, 25][mt_rand(0, 2)]; $b = [15, 20][mt_rand(0, 1)]; $h = 10;
            $mode = mt_rand(0, 2) === 0 ? 'cod' : 'prepaid';
            $inv = mt_rand(5, 40) * 100;
            $qt = quote($c[11], $d[1], $w, $l, $b, $h, $mode, $inv, $u);
            $o = $qt['options'][0];
            $daysAgo = $i < 12 ? (int) floor($i * 0.55) : (int) floor($i * 1.4);
            $created = date('Y-m-d H:i:s', strtotime("-$daysAgo days -" . mt_rand(1, 8) . " hours"));
            $st = $i < 12 ? $statuses[($i + $ci) % count($statuses)] : ($i % 9 === 0 ? 'rto_delivered' : 'delivered');
            $sid = insert('shipments', [
                'order_no' => 'VS-' . (10300 + $ci * 40 + $i), 'awb' => (string) ($awb++), 'user_id' => $uid, 'pickup_id' => $pid,
                'from_name' => $c[1], 'from_contact' => $c[0], 'from_phone' => $c[3], 'from_address' => $c[12], 'from_city' => $c[2], 'from_state' => $c[13], 'from_pincode' => $c[11],
                'to_name' => $d[0], 'to_phone' => '97' . mt_rand(10000000, 99999999), 'to_address' => $d[4], 'to_city' => $d[2], 'to_state' => $d[3], 'to_pincode' => $d[1],
                'product' => $products[mt_rand(0, count($products) - 1)], 'invoice_value' => $inv, 'payment_mode' => $mode, 'cod_amount' => $mode === 'cod' ? $inv : 0,
                'weight' => $w, 'length' => $l, 'breadth' => $b, 'height' => $h, 'vol_weight' => $qt['vol_weight'], 'chargeable_weight' => $qt['chargeable_weight'],
                'zone' => $qt['zone'], 'service' => 'surface', 'markup_pct' => $qt['markup'], 'base_rate' => $o['base'], 'cod_base' => $o['cod_base'],
                'freight' => $o['freight'], 'cod_charge' => $o['cod_charge'], 'gst' => $o['gst'], 'total' => $o['total'], 'status' => $st,
                'pickup_date' => substr($created, 0, 10), 'pickup_slot' => '2 PM – 6 PM', 'eta' => date('Y-m-d', strtotime($created . ' +4 days')),
                'delivered_at' => in_array($st, ['delivered']) ? date('Y-m-d H:i:s', strtotime($created . ' +3 days')) : null,
                'courier_weight' => $st === 'delivered' ? $qt['chargeable_weight'] : null,
                'ndr_attempts' => $st === 'ndr' ? mt_rand(1, 2) : 0, 'ndr_reason' => $st === 'ndr' ? ['Customer not available', 'Address incomplete'][mt_rand(0, 1)] : null,
                'cod_status' => $mode === 'cod' ? ($st === 'delivered' ? ($daysAgo > 10 ? 'remitted' : 'pending') : 'na') : 'na',
                'rto_charged' => in_array($st, ['rto_in_transit', 'rto_delivered']) ? 1 : 0,
                'created_at' => $created,
            ]);
            wallet_txn($uid, 'debit', $o['total'], 'Shipment ' . ($awb - 1), (string) ($awb - 1), 'shipment');
            q("UPDATE wallet_txns SET created_at=? WHERE id=LAST_INSERT_ID()", [$created]);
            seed_events($sid, $st, $created, $c[2], $d[2]);
            if (in_array($st, ['rto_in_transit', 'rto_delivered'])) {
                wallet_txn($uid, 'debit', $o['freight'], 'RTO charges ' . ($awb - 1), (string) ($awb - 1), 'rto');
                update('shipments', ['rto_charge' => $o['freight']], 'id=?', [$sid]);
            }
            if (in_array($st, ['delivered', 'in_transit']) && ($i === 2 || $i === 5 || $i === 14 || ($ci === 0 && in_array($i, [3, 16])))) seed_dispute($sid, $i === 5 ? 'disputed' : 'open');
        }
    }
    // remittances for remitted COD
    foreach (all("SELECT user_id, SUM(cod_amount) amt, COUNT(*) n FROM shipments WHERE cod_status='remitted' GROUP BY user_id") as $r) {
        $rid = insert('cod_remittances', ['user_id' => $r['user_id'], 'amount' => $r['amt'], 'shipments' => $r['n'], 'utr' => 'UTR' . mt_rand(100000000, 999999999),
            'status' => 'paid', 'remit_date' => date('Y-m-d', strtotime('-5 days'))]);
        q("UPDATE shipments SET remittance_id=? WHERE user_id=? AND cod_status='remitted'", [$rid, $r['user_id']]);
    }
    api_log('Create shipment (CMU)', 'Order #VS-10325', 'success');
    api_log('Pincode serviceability', '411001', 'success');
    api_log('Shipping cost calculation', '110034 → 411001 · 1.2 kg', 'success');
}

function seed_events(int $sid, string $st, string $created, string $fromCity, string $toCity): void {
    $t = strtotime($created);
    $chain = [
        ['pickup_pending', 'Booked · AWB generated', 'vishwaship.com'],
        ['picked_up', 'Picked up', $fromCity], ['in_transit', 'Shipped / dispatched', $fromCity . ' Gateway'],
        ['in_transit', 'In transit', 'Bhiwandi Gateway'], ['in_transit', 'Reached destination hub', $toCity . ' Hub'],
        ['out_for_delivery', 'Out for delivery', $toCity . ' DC'], ['delivered', 'Delivered', $toCity],
    ];
    $upto = ['pickup_pending' => 0, 'picked_up' => 1, 'in_transit' => 3, 'out_for_delivery' => 5, 'delivered' => 6, 'ndr' => 5, 'rto_in_transit' => 5, 'rto_delivered' => 5][$st] ?? 0;
    for ($i = 0; $i <= $upto; $i++) { add_event($sid, $chain[$i][0], $chain[$i][1], $chain[$i][2], '', date('Y-m-d H:i:s', $t)); $t += 3600 * mt_rand(4, 12); }
    if ($st === 'ndr') add_event($sid, 'ndr', 'Delivery attempted — failed', $toCity . ' DC', 'Customer not available', date('Y-m-d H:i:s', $t));
    if (str_starts_with($st, 'rto')) add_event($sid, 'rto_in_transit', 'RTO initiated — returning to origin', $toCity . ' DC', 'Refused by customer', date('Y-m-d H:i:s', $t));
    if ($st === 'rto_delivered') add_event($sid, 'rto_delivered', 'RTO delivered to seller', $fromCity, '', date('Y-m-d H:i:s', $t + 86400 * 3));
}

function seed_dispute(int $sid, string $status): void {
    $s = one("SELECT s.*, u.markup_pct um FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.id=?", [$sid]);
    $cw = $s['chargeable_weight'] + (mt_rand(0, 1) ? 0.5 : 1.0);
    create_dispute($s, $cw, '38×28×14', [], $status === 'disputed' ? 'Raised on Delhivery' : null, $status);
}

/** Create a weight discrepancy for a shipment (used by admin + seed) */
function create_dispute(array $s, float $courierWeight, string $courierDims, array $proofIds = [], ?string $delhivery = null, string $status = 'open', string $proofLabels = ''): int {
    $user = one("SELECT * FROM users WHERE id=?", [$s['user_id']]);
    $vol = 0;
    if (preg_match('/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/', $courierDims, $m)) $vol = vol_weight($m[1], $m[2], $m[3]);
    $charged = slab_weight(max($courierWeight, $vol));
    $newBase = base_rate_card($s['service'], $s['zone'] ?: zone_for($s['from_pincode'], $s['to_pincode']), $charged);
    $baseExtra = max(0, round($newBase - $s['base_rate'], 2));
    $custExtra = $baseExtra > 0 ? apply_markup($baseExtra, (float) $s['markup_pct'] ?: markup_for($user)) : 0;
    $days = (int) setting('auto_accept_days', 7);
    $id = insert('weight_disputes', [
        'shipment_id' => $s['id'], 'user_id' => $s['user_id'], 'awb' => $s['awb'],
        'declared_weight' => $s['weight'], 'declared_dims' => (float)$s['length'] . '×' . (float)$s['breadth'] . '×' . (float)$s['height'], 'declared_vol' => $s['vol_weight'],
        'courier_weight' => $courierWeight, 'courier_dims' => $courierDims, 'courier_vol' => $vol, 'charged_weight' => $charged,
        'earlier_amount' => $s['freight'], 'revised_amount' => $s['freight'] + $custExtra, 'base_extra' => $baseExtra, 'customer_extra' => $custExtra,
        'status' => $status, 'delhivery_dispute' => $delhivery, 'customer_action' => $status === 'disputed' ? 'Disputed + photos' : 'Pending',
        'proof_ids' => implode(',', $proofIds), 'proof_labels' => $proofLabels ?: 'Weighing scale · ' . $courierWeight . ' kg|Length|Width × height',
        'deadline' => date('Y-m-d H:i:s', strtotime("+$days days")),
    ]);
    update('shipments', ['wd_open' => in_array($status, ['open', 'disputed']) ? 1 : 0], 'id=?', [$s['id']]);
    return $id;
}
