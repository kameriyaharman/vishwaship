# Vishwaship — Logistics Web Portal

Courier booking portal for sellers & businesses (Delhivery-powered) with a customer portal and a fully admin-managed back office.

| Part | Tech | Folder |
|---|---|---|
| Frontend | Next.js 15 (static export) | `frontend/` |
| Backend API | PHP 8 (no framework, PDO) | `backend/` |
| Database | MySQL 8 / MariaDB | auto-created by the API on first request |

## Default logins (change after first login)

- **Admin:** `admin@vishwaship.com` / `Admin@123` (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` env before first run to change)
- **Demo customer:** `rahul@kumartraders.in` / `Demo@123`

Demo customers & shipments are seeded so every screen has data. Remove them from **Admin → Staff & Roles → Remove demo data** (or set `SEED_DEMO=0` before first run).

## What the admin controls

- Global markup %, customer-wise markup, base rate card (5 zones × Surface/Express), COD / RTO / GST / rounding / volumetric rules
- Customers: add/edit, KYC verify/reject, block, wallet credit/debit, credit limit, login-as-customer
- All shipments: base vs final vs margin, status updates & tracking events, cancel + refund, labels, Excel export
- Weight discrepancies (with proof photos), auto-accept rules, Delhivery dispute outcome & refunds
- NDR / RTO, COD received → remitted (bank UTR or wallet), monthly GST invoices
- Delhivery API (token, staging/production, simulation ↔ live), pickup-location registration, API logs, webhook URL
- Website content (hero, features, services, contact, terms…), company details, pickup slots, KYC rule, Razorpay keys
- Staff accounts with section-wise permissions, support tickets and website enquiries

## Delhivery

Starts in **Simulation mode** (generated AWBs, admin rate card, manual status updates). To go live: Admin → Delhivery API → paste token, choose environment, set Mode = Live → Save → Test connection. Give Delhivery the webhook URL shown on that page for automatic status updates.

## Environment variables (backend)

```
MYSQL_URL=mysql://user:pass@host:3306/dbname      # or DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
APP_SECRET=<long random string>                     # signs login tokens
CORS_ORIGINS=https://vishwaship.com                 # comma-separated, * allowed
ADMIN_EMAIL=… ADMIN_PASSWORD=… SEED_DEMO=1          # first run only
```

Frontend build variable: `NEXT_PUBLIC_API_URL` (defaults to `/api`, i.e. same domain).

## Deploy on Hostinger (shared / cloud hosting)

1. **Database:** hPanel → Databases → create a MySQL DB + user.
2. **API:** upload everything in `backend/` to `public_html/api/`. Create `public_html/api/.env.php`-style config by setting env in `.htaccess`:
   ```
   SetEnv DB_HOST localhost
   SetEnv DB_NAME u123_vishwaship
   SetEnv DB_USER u123_vs
   SetEnv DB_PASS yourpassword
   SetEnv APP_SECRET some-long-random-string
   ```
   (add these lines at the top of `backend/.htaccess`). Open `https://yourdomain.com/api/health` — tables are created automatically.
3. **Frontend:** on your computer run `cd frontend && npm install && npm run build` (leave `NEXT_PUBLIC_API_URL` unset so it uses `/api`). Upload the contents of `frontend/out/` to `public_html/`.
4. Done — `https://yourdomain.com` is the website, `/login/?admin=1` is the admin login.

## Deploy on Railway

Three services: MySQL (template), `backend` (root dir `/backend`, Dockerfile) with `MYSQL_URL=${{MySQL.MYSQL_URL}}`, and `frontend` (root dir `/frontend`, Dockerfile) with `NEXT_PUBLIC_API_URL=https://<backend-domain>`.

## Local development

```
# API (needs a local MySQL)
cd backend && DB_USER=root DB_NAME=vishwaship php -S localhost:8080 router.php
# Web
cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
```
