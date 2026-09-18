# THEKARTAVYAMOVEMENTBACKEND — Memory & Architecture Reference

> This file is the single source of truth for anyone (human or AI) picking up
> this backend codebase. Keep it updated whenever significant changes are made.

---

## 1. Purpose

This is the Node.js REST API backend for **The Kartavya Movement** website
(`thekartavyamovement.org`). It:

1. Receives contact form submissions from the Angular frontend.
2. Persists every enquiry to a database (MySQL **or** PostgreSQL — switchable).
3. Sends email notifications to two organisation inboxes.
4. Sends an acknowledgement email back to the person who submitted the form.

---

## 2. Tech Stack

| Layer          | Technology                                  | Version        |
|----------------|---------------------------------------------|----------------|
| Runtime        | Node.js                                     | ≥ 18.x         |
| Framework      | Express                                     | 4.22.3         |
| DB (MySQL)     | mysql2/promise pool                         | 3.24.4         |
| DB (Postgres)  | pg (node-postgres) Pool                     | 8.12.0         |
| Email          | Nodemailer (Gmail SMTP / App Password)      | 10.0.10        |
| Validation     | express-validator                           | 7.3.2          |
| Rate limiting  | express-rate-limit                          | 7.3.1          |
| CORS           | cors                                        | 2.8.5          |
| Env vars       | dotenv                                      | 16.4.5         |
| Dev server     | nodemon                                     | 3.1.3 (devDep) |

---

## 3. Folder Structure

```
THEKARTAVYAMOVEMENTBACKEND/
├── .env.example                  ← Template — copy to .env and fill values
├── .env                          ← NEVER commit — gitignored
├── .gitignore
├── memory.md                     ← This file
├── package.json
├── render.yaml                   ← Render deployment config
└── src/
    ├── server.js                 ← Entry point: Express app + startup checks
    ├── config/
    │   ├── db.js                 ← Adapter router: loads mysql or postgres driver based on DB_DRIVER
    │   ├── db.mysql.js           ← MySQL adapter  (unified interface over mysql2 pool)
    │   ├── db.postgres.js        ← PostgreSQL adapter (unified interface over pg Pool)
    │   └── mailer.js             ← Nodemailer transporter (SMTP, auto-verified at startup)
    ├── controllers/
    │   └── enquiry.controller.js ← Driver-agnostic: createEnquiry, listEnquiries, getEnquiry, updateEnquiryStatus
    ├── database/
    │   ├── schema.sql            ← MySQL schema  (raw SQL, for reference / manual apply)
    │   ├── schema.postgres.sql   ← PostgreSQL schema (raw SQL, for reference / manual apply)
    │   └── setup.js              ← One-time DB init script — supports both drivers
    ├── middleware/
    │   ├── errorHandler.js       ← Centralised Express error handler (last middleware)
    │   ├── requestLogger.js      ← Logs method + URL + status + response time
    │   └── validateEnquiry.js    ← express-validator rules + per-route rate limiter
    ├── routes/
    │   └── enquiry.routes.js     ← All /api/enquiries routes
    └── services/
        └── emailService.js       ← Sends notification + ack emails (non-fatal async)
```

---

## 4. Database Driver Switch

**One environment variable controls which database is used:**

```
DB_DRIVER=mysql     # default — uses MySQL via mysql2
DB_DRIVER=postgres  # uses PostgreSQL via pg
```

Set it in `.env` (local) or in the Render dashboard (production).

### How it works

```
src/config/db.js  (the only file all other code imports)
      │
      ├─ DB_DRIVER=mysql    → loads db.mysql.js   (mysql2 pool)
      └─ DB_DRIVER=postgres → loads db.postgres.js (pg Pool)
```

Both adapters expose **exactly the same interface**:

| Method | Description |
|--------|-------------|
| `db.query(sql, params)` | Run a single query. Returns `{ rows, rowCount, insertId }` |
| `db.getClient()` | Get a dedicated connection. Returns `{ query, release }` |
| `db.end()` | Drain the pool (setup scripts only) |
| `db.driver` | String: `'mysql'` or `'postgres'` |
| `db.getSql()` | Returns driver-specific SQL fragments used by the controller |

SQL uses `?` placeholders throughout. The PostgreSQL adapter auto-converts them to `$1, $2, …` before execution — no changes needed in controller code.

### Key dialect differences (handled transparently by `getSql()`)

| Feature       | MySQL                          | PostgreSQL                          |
|---------------|--------------------------------|-------------------------------------|
| Placeholders  | `?`                            | `$1, $2, …` (auto-converted)        |
| Insert + ID   | `INSERT …` + `insertId`        | `INSERT … RETURNING id`             |
| String trim   | `LEFT(col, 120)`               | `SUBSTRING(col FROM 1 FOR 120)`     |
| Count result  | `'5'` (string)                 | `5` (integer, cast with `::int`)    |
| Status type   | `ENUM('new','read',…)`         | `TEXT CHECK (status IN (…))`        |
| Timestamps    | `DATETIME DEFAULT NOW()`       | `TIMESTAMPTZ DEFAULT NOW()`         |
| updated_at    | `ON UPDATE CURRENT_TIMESTAMP`  | Trigger `set_updated_at()`          |
| Auto-increment| `INT UNSIGNED AUTO_INCREMENT`  | `BIGSERIAL`                         |

---

## 5. API Endpoints

Base URL (local dev): `http://localhost:3000`

| Method | Path                        | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/health`                   | Health check — returns 200 + timestamp         |
| POST   | `/api/enquiries`            | Submit a new enquiry (contact form)            |
| GET    | `/api/enquiries`            | List all enquiries (paginated, filterable)     |
| GET    | `/api/enquiries/:id`        | Fetch single enquiry (auto-marks new → read)  |
| PATCH  | `/api/enquiries/:id/status` | Update enquiry workflow status                 |

### POST /api/enquiries — Request Body

```json
{
  "name":    "Jane Doe",
  "email":   "jane@example.com",
  "subject": "Volunteer enquiry",
  "message": "I would love to get involved..."
}
```

### POST /api/enquiries — Success Response (201)

```json
{
  "success": true,
  "message": "Thank you for reaching out. We will get back to you soon.",
  "data": { "id": 42 }
}
```

### GET /api/enquiries — Query Params

| Param    | Default | Description                                      |
|----------|---------|--------------------------------------------------|
| `page`   | `1`     | Page number                                      |
| `limit`  | `20`    | Results per page (max 100)                       |
| `status` | _(all)_ | Filter: `new`, `read`, `replied`, `archived`     |

### PATCH /api/enquiries/:id/status — Body

```json
{ "status": "replied" }
```

---

## 6. Database Schema

**Database name:** `kartavya_movement`

### Table: `enquiries`

| Column       | MySQL type            | PostgreSQL type        | Notes                          |
|--------------|-----------------------|------------------------|--------------------------------|
| `id`         | INT UNSIGNED PK AI    | BIGSERIAL PK           | Auto-increment primary key     |
| `name`       | VARCHAR(120)          | VARCHAR(120)           | Submitter full name            |
| `email`      | VARCHAR(254)          | VARCHAR(254)           | Submitter email                |
| `subject`    | VARCHAR(255)          | VARCHAR(255)           | Enquiry subject line           |
| `message`    | TEXT                  | TEXT                   | Full message body              |
| `status`     | ENUM(new/read/…)      | TEXT CHECK(…)          | Workflow status                |
| `ip_address` | VARCHAR(45) NULL      | VARCHAR(45)            | IPv4 or IPv6, nullable         |
| `user_agent` | VARCHAR(512) NULL     | VARCHAR(512)           | Browser user-agent, nullable   |
| `created_at` | DATETIME              | TIMESTAMPTZ            | Auto-set on insert             |
| `updated_at` | DATETIME ON UPDATE    | TIMESTAMPTZ + trigger  | Auto-updated on every change   |

**Indexes:** `idx_enquiries_email`, `idx_enquiries_status`, `idx_enquiries_created_at`

---

## 7. Email Flow

On every successful form submission:

1. **Notification email** → `connect@thekartavyamovement.org` AND `thekartavyamovement@gmail.com`
   - Subject: `[New Enquiry #<id>] <subject>`
   - HTML + plain text, reply-to set to submitter's email

2. **Acknowledgement email** → submitter's email address
   - Subject: `We received your message — The Kartavya Movement`
   - States 2–3 working days response time

Both sends are **non-fatal** — enquiry is saved to DB first, emails fire asynchronously.

---

## 8. Environment Variables

Copy `.env.example` to `.env`. **Never commit `.env`**.

| Variable             | Required        | Description                                        |
|----------------------|-----------------|----------------------------------------------------|
| `PORT`               | No              | HTTP port (default: 3000)                          |
| `NODE_ENV`           | No              | `development` or `production`                      |
| `ALLOWED_ORIGINS`    | No              | Comma-separated CORS origins                       |
| **`DB_DRIVER`**      | No (def: mysql) | `mysql` or `postgres`                              |
| `DATABASE_URL`       | Postgres only   | Full connection string — takes priority over DB_*  |
| `DB_HOST`            | Yes*            | Database host (*not needed if DATABASE_URL is set) |
| `DB_PORT`            | No              | 3306 (MySQL) or 5432 (Postgres)                    |
| `DB_NAME`            | Yes*            | Database name                                      |
| `DB_USER`            | Yes*            | Database username                                  |
| `DB_PASSWORD`        | Yes*            | Database password                                  |
| `DB_CONNECTION_LIMIT`| No              | Pool size (default: 10)                            |
| `DB_SSL`             | No              | `true` to enable SSL for PostgreSQL                |
| `SMTP_HOST`          | Yes             | SMTP server (default: smtp.gmail.com)              |
| `SMTP_PORT`          | No              | SMTP port (default: 587)                           |
| `SMTP_SECURE`        | No              | `true` for port 465, `false` for 587               |
| `SMTP_USER`          | Yes             | Gmail address                                      |
| `SMTP_PASS`          | Yes             | Gmail App Password (16 chars)                      |
| `NOTIFY_EMAIL_1`     | No              | First notification recipient                       |
| `NOTIFY_EMAIL_2`     | No              | Second notification recipient                      |
| `FROM_EMAIL`         | No              | `From:` header in sent emails                      |

> **Gmail App Password:** enable 2FA → https://myaccount.google.com/apppasswords → create app password → paste into `SMTP_PASS`.

---

## 9. Security Measures

| Concern           | Implementation                                                    |
|-------------------|-------------------------------------------------------------------|
| Input validation  | `express-validator` — trim, escape, type & length checks         |
| SQL injection     | Parameterised queries only (`?` placeholders, never string concat)|
| XSS              | All user input escaped before DB storage and email output         |
| Rate limiting     | Global: 100/15 min. Enquiry endpoint: 5/10 min per IP            |
| CORS             | Whitelist-only via `ALLOWED_ORIGINS`                              |
| Payload size      | Body limited to 50 KB                                             |
| Secrets          | All credentials in `.env`, `.gitignore`d                          |
| Error exposure    | Stack traces hidden from clients in `NODE_ENV=production`         |
| Proxy trust       | `trust proxy 1` set — correct IP behind Render's reverse proxy   |

---

## 10. First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env
copy .env.example .env    # Windows
cp .env.example .env      # macOS / Linux

# 3. Edit .env — set DB_DRIVER, credentials, and Gmail App Password

# 4. Create database schema
npm run db:setup              # uses DB_DRIVER from .env
npm run db:setup:mysql        # force MySQL
npm run db:setup:postgres     # force PostgreSQL

# 5. Start the server
npm run dev        # development (nodemon)
npm start          # production
```

---

## 11. Render Deployment

### Files
| File | Purpose |
|------|---------|
| `render.yaml` | Infrastructure-as-code — auto-configures the Render web service |
| `src/server.js` | Binds to `0.0.0.0`; sets `trust proxy 1` |

### Step-by-step

1. Push this repo to GitHub (`thekartavyamovement/thekartavyamovementbackend` — already configured).
2. Go to [render.com](https://render.com) → **New → Web Service** → connect GitHub → select the repo.
3. Render detects `render.yaml` automatically. Confirm:
   - Build: `npm ci` · Start: `npm start` · Region: Singapore
4. In **Environment → Add Environment Variable**, set the `sync: false` vars:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Full `postgres://…` string from your Postgres provider |
   | `SMTP_USER` | `thekartavyamovement@gmail.com` |
   | `SMTP_PASS` | Gmail App Password |
   | `ALLOWED_ORIGINS` | `https://thekartavyamovement.org` |

5. Run the schema setup **once** against your production DB before the first deploy:
   ```bash
   DATABASE_URL=postgres://... DB_DRIVER=postgres npm run db:setup
   ```
6. Click **Create Web Service** → API goes live at:
   ```
   https://thekartavyamovement-backend.onrender.com
   ```

### Recommended PostgreSQL providers for Render

| Provider | Free tier | Notes |
|----------|-----------|-------|
| [Render Postgres](https://render.com/docs/databases) | 1 GB free | Same platform, low latency |
| [Supabase](https://supabase.com) | 500 MB free | Postgres + dashboard UI |
| [Neon](https://neon.tech) | Generous free tier | Serverless Postgres, branching |
| [Railway](https://railway.app) | ~$5/mo | Simple provisioning |

### MySQL providers for Render (if DB_DRIVER=mysql)

| Provider | Notes |
|----------|-------|
| [PlanetScale](https://planetscale.com) | Serverless MySQL |
| [Aiven](https://aiven.io) | Managed MySQL, free trial |
| Your own VPS | Set DB_HOST to the VPS IP |

### Free tier note
Render free tier spins down after 15 min of inactivity. First request after idle takes ~30 s.
Upgrade to **Starter ($7/mo)** for always-on.

### After deployment — update the frontend
```typescript
// thekartavyamovement/src/environments/environment.production.ts
export const environment = {
  production: true,
  apiUrl: 'https://thekartavyamovement-backend.onrender.com',
};
```

---

## 12. Known Limitations & Future Work

- [ ] GET / PATCH admin endpoints have no authentication — add API key or JWT before public exposure
- [ ] No admin dashboard — build a simple Angular admin page to browse enquiries
- [ ] No email retry queue — consider Bull/BullMQ + Redis for production reliability
- [ ] No file attachment support
- [ ] Consider SendGrid / Postmark for better deliverability at scale
