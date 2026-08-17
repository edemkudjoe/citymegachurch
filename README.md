# City Mega Church — Website & Prayer Camp Booking System

A church website with member accounts, content management, and a prayer camp registration/booking system, built as static HTML/CSS/JS pages backed by Vercel serverless functions and Supabase (Postgres + Storage).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Static HTML, CSS, vanilla JavaScript (no framework, no build tool) |
| Backend | Vercel Serverless Functions (Node.js, in `/api`) |
| Database | Supabase Postgres |
| File storage | Supabase Storage |
| Auth | Custom JWT + bcrypt (not Supabase Auth) |
| Hosting | Vercel |

---

## Project Structure

```
citymegachurch/
├── api/                    # Serverless functions — one file = one route
│   ├── auth/
│   │   ├── login.js
│   │   └── register.js
│   ├── admin-stats.js      # Aggregate counts for the admin dashboard overview
│   ├── bookings.js         # Camp booking CRUD (public create + admin manage)
│   ├── camps.js            # Prayer camp CRUD + availability
│   ├── church-info.js      # Single-row church settings (name, bio, socials, etc.)
│   ├── content.js          # Shared CRUD for services/ministries/events/sermons/articles
│   ├── gallery.js          # Photo gallery CRUD with tag filtering
│   ├── my-bookings.js      # Logged-in user's own bookings + claim-by-reference
│   ├── profile.js          # Logged-in user's own profile
│   ├── setup-admin.js      # One-time admin account bootstrap
│   └── upload.js           # Base64 file upload to Supabase Storage
├── lib/
│   ├── auth.js             # JWT sign/verify, requireAuth/requireAdmin, CORS
│   └── supabase.js         # Supabase client (service_role key)
├── public/                 # Everything served to the browser
│   ├── index.html, about.html, services.html, ministries.html,
│   │   events.html, sermons.html, gallery.html, articles.html,
│   │   article.html, contact.html         # Public-facing pages
│   ├── login.html, register.html, dashboard.html   # Member area
│   ├── book-camp.html, booking-status.html         # Camp booking flow
│   ├── admin/                              # Admin dashboard (role-gated)
│   │   ├── dashboard.html
│   │   ├── bookings.html
│   │   ├── camps.html
│   │   ├── content.html
│   │   ├── css/
│   │   └── js/
│   │       ├── admin-layout.js             # Auth guard + shared admin nav
│   │       └── upload-helper.js            # Base64 file upload helper
│   ├── js/
│   │   ├── api.js                          # Shared fetch wrapper, token storage, toasts
│   │   └── layout.js                       # Shared public-site nav/footer
│   ├── css/main.css
│   └── images/
├── schema.sql               # Full Supabase database schema — run once in SQL Editor
├── vercel.json               # Rewrites all non-/api routes to /public
├── package.json
├── DOCUMENTATION.md
└── README.md
```

---

## How Routing Works

`vercel.json` rewrites every request that isn't under `/api/...` to `/public/...`, so:

- `citymegachurch.org/` → `public/index.html`
- `citymegachurch.org/admin/bookings.html` → `public/admin/bookings.html`
- `citymegachurch.org/api/bookings` → runs `api/bookings.js` as a serverless function

There's no client-side router — every page is a real, separate `.html` file.

---

## Getting Started (Local Development)

1. **Clone the repo** and install dependencies:
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com).
3. **Run the schema**: open the Supabase SQL Editor and run the entire contents of `schema.sql`. This creates all tables, triggers, the `camp_availability` view, and Row Level Security policies. The file is safe to re-run later after a pull — table-creation statements are skipped if the tables already exist, and any `alter table ... add column if not exists` statements at the bottom will backfill new columns onto your existing database without touching your data.
4. **Create Storage buckets** in Supabase named: `gallery`, `sermons`, `events`, `articles`, `church-assets` — make each **public** (read access) so uploaded images/files can be displayed on the site.
5. **Set environment variables** (see [Environment Variables](#environment-variables) below) — locally in a `.env` file for `vercel dev`, and in the Vercel dashboard for production.
6. **Run locally**:
   ```bash
   npm run dev
   ```
   This runs `vercel dev`, which serves `/public` and executes `/api` functions locally.
7. **Create the first admin account** — see [Creating the First Admin](#creating-the-first-admin).

---

## Environment Variables

Set these in the Vercel project settings (Settings → Environment Variables) and/or a local `.env` file for `vercel dev`:

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | `lib/supabase.js` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.js` | Service-role key — bypasses Row Level Security. **Never expose this to the frontend.** |
| `JWT_SECRET` | `lib/auth.js` | Secret used to sign/verify member and admin login tokens. Use a long random string. |
| `SETUP_SECRET` | `api/setup-admin.js` | One-time password required to call `/api/setup-admin`. Remove or unset after creating the admin account. |
| `ALLOWED_ORIGIN` | `lib/auth.js` | CORS allow-origin header. Defaults to `*` if unset; set to your real domain in production. |

---

## Creating the First Admin

There's no sign-up flow for admins — the `/api/setup-admin` endpoint creates exactly one admin account and is protected by `SETUP_SECRET`.

1. Set `SETUP_SECRET` in your environment variables (any random string).
2. Send a one-time POST request (via Postman, curl, or similar):
   ```bash
   curl -X POST https://yourdomain.com/api/setup-admin \
     -H "Content-Type: application/json" \
     -d '{
       "setup_secret": "YOUR_SETUP_SECRET",
       "full_name": "Admin Name",
       "email": "admin@example.com",
       "password": "a-strong-password",
       "phone": "0000000000"
     }'
   ```
3. **Immediately after**, remove `SETUP_SECRET` from your environment variables (or delete `api/setup-admin.js` entirely) so the endpoint can never be called again.
4. Log in at `/login.html` with the admin credentials — the layout script automatically routes admins to `/admin/dashboard.html`.

---

## Deployment

This project is built to deploy without any build tooling:

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables listed above in the Vercel project settings.
4. Deploy — Vercel automatically serves `/public` as static files and `/api` as serverless functions per `vercel.json`.

No build command is required (there is no `build` script — pages are plain HTML/CSS/JS).

---

## Further Documentation

See `DOCUMENTATION.md` for:
- Full page-by-page breakdown of the frontend
- Complete API reference (every endpoint, method, and payload)
- Database schema explanation
- Authentication & authorization model
- File upload / Supabase Storage flow
- Admin dashboard feature guide
