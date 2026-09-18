# The Kartavya Movement — Full-Stack Project Tracker

> **This file lives in both projects.**  
> Frontend: `thekartavyamovement/PROJECT_TRACKER.md`  
> Backend:  `THEKARTAVYAMOVEMENTBACKEND/PROJECT_TRACKER.md`  
>
> Keep both copies in sync whenever you update this file.  
> It is the shared contract between the frontend and backend teams.

---

## Project Overview

| Item              | Detail                                    |
|-------------------|-------------------------------------------|
| **Organisation**  | The Kartavya Movement                     |
| **Website**       | https://thekartavyamovement.org           |
| **Frontend**      | Angular 19 + SSR (`thekartavyamovement/`) |
| **Backend**       | Node.js 18+ / Express (`THEKARTAVYAMOVEMENTBACKEND/`) |
| **Database**      | MySQL — database `kartavya_movement`      |
| **Email**         | Gmail SMTP via Nodemailer (App Password)  |
| **Notification recipients** | `connect@thekartavyamovement.org` · `thekartavyamovement@gmail.com` |

---

## API Contract (Frontend ↔ Backend)

### Endpoint

| Environment | URL                                         |
|-------------|---------------------------------------------|
| Local dev   | `POST http://localhost:4200/api/contact`    |
| Production  | `POST https://thekartavyamovement.org/api/contact` |

> The Angular dev proxy (`proxy.conf.json`) rewrites `/api/contact` → `http://localhost:3000/api/enquiries`.

### Request

```http
POST /api/contact
Content-Type: application/json

{
  "name":    "Jane Doe",
  "email":   "jane@example.com",
  "subject": "Volunteer enquiry",
  "message": "I would love to get involved with your mission..."
}
```

| Field     | Type   | Max length | Required |
|-----------|--------|------------|----------|
| `name`    | string | 120        | ✓        |
| `email`   | string | 254        | ✓        |
| `subject` | string | 255        | ✓        |
| `message` | string | 5000       | ✓        |

### Responses

| Status | Meaning                     | Body shape                                                |
|--------|-----------------------------|-----------------------------------------------------------|
| `201`  | Enquiry saved + emails sent | `{ success: true, message: "...", data: { id: 42 } }`    |
| `422`  | Validation failed           | `{ success: false, errors: [{ field, message }] }`       |
| `429`  | Rate limited                | `{ success: false, message: "Too many requests..." }`    |
| `500`  | Server error                | `{ success: false, message: "..." }`                     |

---

## Completed Work

### ✅ Backend (THEKARTAVYAMOVEMENTBACKEND)

| Date       | Task                                      | Notes                                      |
|------------|-------------------------------------------|--------------------------------------------|
| 2026-09-17 | Project scaffolded                        | Node.js + Express + MySQL + Nodemailer     |
| 2026-09-17 | `POST /api/enquiries` endpoint            | Saves to DB + fires both emails            |
| 2026-09-17 | `GET /api/enquiries` (list, paginated)    | Supports `?page`, `?limit`, `?status`      |
| 2026-09-17 | `GET /api/enquiries/:id`                  | Auto-marks `new` → `read` on first view   |
| 2026-09-17 | `PATCH /api/enquiries/:id/status`         | Workflow: new → read → replied → archived  |
| 2026-09-17 | Input validation + sanitisation           | `express-validator` — all fields           |
| 2026-09-17 | Rate limiting                             | Global 100/15 min + enquiry 5/10 min/IP   |
| 2026-09-17 | CORS whitelist                            | `ALLOWED_ORIGINS` env var                  |
| 2026-09-17 | Dual email notifications                  | HTML + text, both recipients               |
| 2026-09-17 | Submitter acknowledgement email           | Auto-reply to form submitter               |
| 2026-09-17 | MySQL schema + setup script               | `npm run db:setup`                         |
| 2026-09-17 | `memory.md` written                       | Full architecture reference                |
| 2026-09-17 | Render deployment config                  | `render.yaml`, `trust proxy`, `0.0.0.0` bind |

### ✅ Frontend (thekartavyamovement)

| Date       | Task                                       | Notes                                                |
|------------|--------------------------------------------|------------------------------------------------------|
| 2026-09-17 | `src/environments/` created                | `environment.ts` + `environment.production.ts`       |
| 2026-09-17 | `proxy.conf.json` created                  | `/api/contact` → `http://localhost:3000/api/enquiries` |
| 2026-09-17 | `angular.json` updated                     | `proxyConfig` added to serve options                 |
| 2026-09-17 | `provideHttpClient()` added                | `app.config.ts` — `withFetch()` for SSR compat       |
| 2026-09-17 | `ContactService` created                   | `src/app/services/contact.service.ts`                |
| 2026-09-17 | `ContactFormComponent` updated             | Real HTTP submission, loading state, error handling  |

---

## Pending / Backlog

### Backend

| Priority | Task                                                   | Notes                                           |
|----------|--------------------------------------------------------|-------------------------------------------------|
| 🔴 High  | Set all `sync: false` env vars in Render dashboard     | DB_HOST/NAME/USER/PASS, SMTP_USER, SMTP_PASS, ALLOWED_ORIGINS |
| 🔴 High  | Provision a MySQL host (PlanetScale / Railway / Aiven) | Render has no native MySQL                      |
| 🔴 High  | Run `npm run db:setup` against the production DB       | Creates schema before first deploy              |
| 🔴 High  | Secure admin endpoints with API key or JWT             | GET/PATCH routes currently open                 |
| 🟡 Med   | Upgrade Render plan to Starter ($7/mo)                 | Free tier cold-starts after 15 min idle         |
| 🟡 Med   | Set up PM2 or similar if moving off Render             | Render manages restarts natively                |
| 🟢 Low   | Email queue with retry logic (Bull/BullMQ + Redis)     | Better reliability for SMTP failures            |
| 🟢 Low   | Admin dashboard / simple UI to view enquiries          | Could be a separate internal Angular page       |
| 🟢 Low   | Move to SendGrid / Postmark for production email       | Better deliverability than direct Gmail SMTP    |

### Frontend

| Priority | Task                                             | Notes                                          |
|----------|--------------------------------------------------|------------------------------------------------|
| 🔴 High  | Set correct production `apiUrl` in `environment.production.ts` | Update once backend is deployed |
| 🟡 Med   | Add proper server-side form handling for SSR     | Current impl is client-side only               |
| 🟢 Low   | Show per-field inline validation errors from API | Currently shows a single banner on 422         |
| 🟢 Low   | Add loading spinner component                    | Currently just disables button                 |

---

## Environment Setup Checklist

### Backend `.env` (copy from `.env.example`)

- [ ] `DB_HOST` — MySQL host
- [ ] `DB_NAME` — `kartavya_movement`
- [ ] `DB_USER` / `DB_PASSWORD` — MySQL credentials
- [ ] `SMTP_USER` — `thekartavyamovement@gmail.com`
- [ ] `SMTP_PASS` — Gmail App Password (16 characters)
- [ ] `ALLOWED_ORIGINS` — frontend origin(s), comma-separated
- [ ] `NOTIFY_EMAIL_1` — `connect@thekartavyamovement.org`
- [ ] `NOTIFY_EMAIL_2` — `thekartavyamovement@gmail.com`

### First Run Commands

```bash
# Backend
cd THEKARTAVYAMOVEMENTBACKEND
npm install
copy .env.example .env   # then edit .env
npm run db:setup
npm run dev

# Frontend
cd thekartavyamovement
npm install
npm start                 # runs with proxy to backend
```

---

## Architecture Diagram

```
Browser (Angular 19 SSR)
        │
        │  POST /api/contact  (proxied in dev)
        ▼
┌─────────────────────────────────────────┐
│  THEKARTAVYAMOVEMENTBACKEND             │
│  Express  :3000                         │
│                                         │
│  Rate limiter → Validation              │
│        │                                │
│        ▼                                │
│  enquiry.controller.js                  │
│        │                    │           │
│        ▼                    ▼           │
│  MySQL (enquiries)   emailService.js    │
│                             │           │
└─────────────────────────────┼───────────┘
                              │ Gmail SMTP
                   ┌──────────┴──────────┐
                   ▼                     ▼
     connect@thekartavyamovement.org   Submitter's email
     thekartavyamovement@gmail.com     (acknowledgement)
```

---

## Change Log

| Date       | Author | Summary                                                   |
|------------|--------|-----------------------------------------------------------|
| 2026-09-17 | Kiro   | Initial full-stack setup — backend + frontend integration |
