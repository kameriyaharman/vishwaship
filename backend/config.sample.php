<?php
// Copy this file to config.php (same folder) and fill in your Hostinger MySQL details.
// hPanel → Databases → MySQL Databases shows the database name, user and host.
return [
    'DB_HOST'        => 'localhost',
    'DB_PORT'        => '3306',
    'DB_NAME'        => 'u000000000_vishwaship',   // your database name
    'DB_USER'        => 'u000000000_vsuser',       // your database user
    'DB_PASS'        => 'CHANGE-ME',               // your database password

    'APP_SECRET'     => 'CHANGE-ME-to-a-long-random-string', // signs login tokens — keep it secret
    'ADMIN_EMAIL'    => 'admin@vishwaship.com',    // first admin (created on first run only)
    'ADMIN_PASSWORD' => 'CHANGE-ME',
    'SEED_DEMO'      => '0',                       // '1' adds demo customers/orders — keep '0' for live
    'APP_DEBUG'      => '',                        // '1' shows error details — keep empty for live
    'CORS_ORIGINS'   => '*',
];
