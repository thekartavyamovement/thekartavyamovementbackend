# THEKARTAVYAMOVEMENTBACKEND — Memory & Architecture Reference

> This file is the single source of truth for anyone (human or AI) picking up
> this backend codebase. Keep it updated whenever significant changes are made.

---

## 1. Purpose

This is the Node.js + MySQL REST API backend for **The Kartavya Movement** website
(`thekartavyamovement.org`). Its primary responsibility is to:

1. Receive contact form submissions from the Angular frontend.
2. Persist every enquiry to a MySQL database.
3. Send email notifications to two organisation inboxes.
4. Send an acknowledgement email back to the person who submitted the form.

---

## 2. Tech Stack

| Layer          | Technology                          | Version (pinned in package.json) |
|----------------|-------------------------------------|----------------------------------|
| Runtime        | Node.js                             | ≥ 18.x                           |
| Framework      | Express                             | 4.19.2                           |
| Database       | MySQL (via mysql2/promise pool)     | mysql2 3.9.7                     |
| Email          | Nodemailer (Gmail SMTP / App Pass)  | 6.9.13                           |
| Validation     | express-validator                   | 7.1.0                            |
| Rate limiting  | express-rate-limit                  | 7.3.1                            |
| CORS           | cors                                | 2.8.5                            |
| Env vars       | dotenv                              | 16.4.5                           |
| Dev server     | nodemon                             | 3.1.3 (devDep)                   |

---

## 3. Folder Structure

```
THEKARTAVYAMOVEMENTBACKEND/
├── .env.example              ← Template — copy to .env and fill values
├── .env                      ← NEVER commit — gitignored
├── .gitignore
├── memory.md                 ← This file
├── package.json
└── src/
    ├── server.js             ← Entry point: Express app + startup checks
    ├── config/
    │   ├── db.js             ← mysql2 connection pool (auto-tested at start)
    │   └── mailer.js         ← Nodemailer transporter (SMTP, auto-verified)
    ├── controllers/
    │   └── enquiry.controller.js   ← createEnquiry, listEnquiries, getEnquiry, updateEnquiryStatus
    ├── database/
    │   ├── schema.sql        ← Raw SQL — for manual inspection / backup restore
    │   └── setup.js          ← One-time DB init script: npm run db:setup
    ├── middleware/
    │   ├── errorHandler.js   ← Centralised Express error handler (last middleware)
    │   ├── requestLogger.js  ← Logs method + URL + status + response time
    │   └── validateEnquiry.js ← express-validator rules + per-route rate limiter
    ├── routes/
    │   └── enquiry.routes.js ← All /api/enquiries routes
    └── services/
        └── emailService.js   ← Sends notification + ack emails (non-fatal)
```

---

## 4. API Endpoints

Base URL (local dev): `http://localhost:3000`

| Method | Path                          | Description                                        |
|--------|-------------------------------|----------------------------------------------------|
| GET    | `/health`                     | Health check — returns 200 + timestamp             |
| POST   | `/api/enquiries`              | Submit a new enquiry (contact form)                |
| GET    | `/api/enquiries`              | List all enquiries (paginated, filterable)         |
| GET    | `/api/enquiries/:id`          | Fetch single enquiry (auto-marks new → read)       |
| PATCH  | `/api/enquiries/:id/status`   | Update enquiry workflow status                     |

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

| Param    | Default | Description                          |
|----------|---------|--------------------------------------|
| `page`   | `1`     | Page number                          |
| `limit`  | `20`    | Results per page (max 100)           |
| `status` | _(all)_ | Filter: `new`, `read`, `replied`, `archived` |

### PATCH /api/enquiries/:id/status — Request Body

```json
{ "status": "replied" }
```

---

## 5. Database

**Database name:** `kartavya_movement`

### Table: `enquiries`

| Column       | Type              | Notes                                      |
|--------------|-------------------|--------------------------------------------|
| `id`         | INT UNSIGNED PK   | Auto-increment primary key                 |
| `name`       | VARCHAR(120)      | Submitter full name                        |
| `email`      | VARCHAR(254)      | Submitter email                            |
| `subject`    | VARCHAR(255)      | Enquiry subject line                       |
| `message`    | TEXT              | Full message body                          |
| `status`     | ENUM              | `new` / `read` / `replied` / `archived`    |
| `ip_address` | VARCHAR(45)       | IPv4 or IPv6, nullable                     |
| `user_agent` | VARCHAR(512)      | Browser user-agent, nullable               |
| `created_at` | DATETIME          | Auto-set on insert                         |
| `updated_at` | DATETIME          | Auto-updated on every change               |

**Indexes:** `idx_email`, `idx_status`, `idx_created_at`

---

## 6. Email Flow

On every successful form submission:

1. **Notification email** → `connect@thekartavyamovement.org` AND `thekartavyamovement@gmail.com`
   - Subject: `[New Enquiry #<id>] <subject>`
   - Contains: all form fields, timestamp, reply-to set to submitter's email
   - HTML + plain text versions

2. **Acknowledgement email** → submitter's email address
   - Subject: `We received your message — The Kartavya Movement`
   - Thanks them, states 2–3 working days response time
   - Gives direct email for urgent matters

Both sends are **non-fatal** — if SMTP fails, the enquiry is already saved to DB
and the API still returns 201. Failures are logged to console only.

---

## 7. Environment Variables

Managed via `.env` (copy from `.env.example`). **Never commit `.env`**.

| Variable             | Required | Description                                      |
|----------------------|----------|--------------------------------------------------|
| `PORT`               | No       | HTTP port (default: 3000)                        |
| `NODE_ENV`           | No       | `development` or `production`                    |
| `ALLOWED_ORIGINS`    | No       | Comma-separated CORS origins                     |
| `DB_HOST`            | **Yes**  | MySQL host                                       |
| `DB_PORT`            | No       | MySQL port (default: 3306)                       |
| `DB_NAME`            | **Yes**  | Database name                                    |
| `DB_USER`            | **Yes**  | MySQL username                                   |
| `DB_PASSWORD`        | **Yes**  | MySQL password                                   |
| `DB_CONNECTION_LIMIT`| No       | Pool size (default: 10)                          |
| `SMTP_HOST`          | **Yes**  | SMTP server hostname                             |
| `SMTP_PORT`          | No       | SMTP port (default: 587)                         |
| `SMTP_SECURE`        | No       | `true` for port 465, `false` for 587             |
| `SMTP_USER`          | **Yes**  | SMTP username (Gmail address)                    |
| `SMTP_PASS`          | **Yes**  | Gmail App Password (not account password)        |
| `NOTIFY_EMAIL_1`     | No       | First notification recipient                     |
| `NOTIFY_EMAIL_2`     | No       | Second notification recipient                    |
| `FROM_EMAIL`         | No       | `From:` header in sent emails                    |

> **Gmail App Password setup:**
> 1. Enable 2FA on the Google account.
> 2. Go to https://myaccount.google.com/apppasswords
> 3. Create an app password for "Mail".
> 4. Paste the 16-character password into `SMTP_PASS`.

---

## 8. Security Measures

| Concern            | Implementation                                                   |
|--------------------|------------------------------------------------------------------|
| Input validation   | `express-validator` — trim, escape, type & length checks        |
| SQL injection      | Parameterised queries only (mysql2 `?` placeholders)            |
| XSS               | All user input escaped before DB storage and email output        |
| Rate limiting      | Global: 100 req/15 min. Enquiry endpoint: 5 req/10 min per IP   |
| CORS              | Whitelist-only — configured via `ALLOWED_ORIGINS` in `.env`      |
| Payload size       | Body limited to 50 KB                                            |
| Secrets           | All credentials in `.env`, `.gitignore`d                         |
| Error exposure     | Stack traces hidden from clients in `NODE_ENV=production`        |

---

## 9. First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
copy .env.example .env
# (Windows: copy  |  macOS/Linux: cp)

# 3. Fill in .env with your MySQL credentials and Gmail App Password

# 4. Create the database and table
npm run db:setup

# 5. Start the server
npm run dev        # development (nodemon — auto-restarts on change)
npm start          # production
```

---

## 10. Frontend Integration

The Angular frontend (`thekartavyamovement` project) POSTs to:

```
POST http://localhost:4200/api/contact   (dev — proxied to backend port 3000)
POST https://thekartavyamovement.org/api/contact   (production)
```

> The frontend uses an Angular `proxy.conf.json` that rewrites `/api/contact`
> → `http://localhost:3000/api/enquiries` during local development.

Key frontend files that interact with this API:
- `src/environments/environment.ts` — `apiUrl: 'http://localhost:4200'`
- `src/environments/environment.production.ts` — `apiUrl: 'https://thekartavyamovement.org'`
- `src/app/services/contact.service.ts` — Angular `HttpClient` wrapper
- `src/app/components/contact-form/contact-form.component.ts` — calls the service

---

## 11. Render Deployment

### Files
| File | Purpose |
|------|---------|
| `render.yaml` | Infrastructure-as-code — auto-configures the Render service |
| `src/server.js` | Binds to `0.0.0.0`; sets `trust proxy 1` for correct IP handling |

### Step-by-step

1. **Push this folder to a GitHub/GitLab repository** (it already has a `.git` init).
2. Go to [render.com](https://render.com) → New → Web Service.
3. Connect your GitHub account and select the repo.
4. Render detects `render.yaml` automatically. Confirm:
   - **Build command:** `npm ci`
   - **Start command:** `npm start`
   - **Region:** Singapore (closest to Mumbai)
5. In **Environment → Environment Variables**, add the secrets marked `sync: false` in `render.yaml`:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — your MySQL host credentials
   - `SMTP_USER` — `thekartavyamovement@gmail.com`
   - `SMTP_PASS` — Gmail App Password
   - `ALLOWED_ORIGINS` — `https://thekartavyamovement.org`
6. Click **Create Web Service**. Render runs `npm ci` then `npm start`.
7. Your API will be live at: `https://thekartavyamovement-backend.onrender.com`

### MySQL on Render
Render has no native MySQL service. Recommended free options:
- **[PlanetScale](https://planetscale.com)** — serverless MySQL, free tier available
- **[Aiven](https://aiven.io)** — managed MySQL, free trial
- **[Railway](https://railway.app)** — MySQL plugin, ~$5/mo
- Your own VPS MySQL if already set up

Run `npm run db:setup` once locally pointing at the remote DB to create the schema, then deploy.

### Free tier note
Render's free tier spins the service down after 15 minutes of inactivity. The first request after a cold start takes ~30 seconds. Upgrade to the **Starter plan ($7/mo)** for always-on behaviour.

### After deployment — update the frontend
Set the production API URL in the Angular app:
```typescript
// src/environments/environment.production.ts
export const environment = {
  production: true,
  apiUrl: 'https://thekartavyamovement-backend.onrender.com',
};
```

---

## 12. Known Limitations & Future Work

- [ ] No authentication on GET/PATCH admin endpoints — add API key or JWT before exposing publicly
- [ ] No pagination UI on the admin side — a simple admin dashboard would help
- [ ] Email retry logic not implemented — consider a queue (Bull/BullMQ) for production reliability
- [ ] No file attachment support — add if needed for future forms
- [ ] Consider moving to a managed email service (SendGrid, Postmark) for better deliverability at scale
