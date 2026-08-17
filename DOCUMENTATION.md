# City Mega Church — Technical Documentation

This document is the detailed companion to `README.md`. It covers every page, every API route, the database schema, and how authentication and file uploads work under the hood.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Pages](#2-frontend-pages)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [File Uploads](#6-file-uploads)
7. [Admin Dashboard Guide](#7-admin-dashboard-guide)
8. [Shared Frontend Utilities](#8-shared-frontend-utilities)
9. [Conventions & Patterns](#9-conventions--patterns)

---

## 1. Architecture Overview

```
Browser
  │
  │  static files
  ▼
Vercel (public/) ──────────────► HTML/CSS/JS served as-is, no build step
  │
  │  fetch('/api/...')
  ▼
Vercel Serverless Functions (api/)
  │
  │  service_role key (bypasses RLS)
  ▼
Supabase (Postgres + Storage)
```

- **No frontend framework.** Every page is a standalone `.html` file with inline or linked `<script>` tags using plain DOM APIs (`fetch`, `querySelector`, template strings).
- **No client-side router.** Navigation is real browser navigation between `.html` files.
- **Authentication is custom**, not Supabase Auth — a `users` table stores bcrypt password hashes, and login issues a JWT that the frontend stores in `localStorage` and sends as `Authorization: Bearer <token>`.
- **All database access happens server-side** in `/api` functions using the Supabase **service_role** key, which bypasses Row Level Security. RLS policies in `schema.sql` exist as defense-in-depth in case the anon key is ever exposed, not as the primary access-control layer.

---

## 2. Frontend Pages

### Public pages (`public/`)

| Page | Purpose |
|---|---|
| `index.html` | Homepage — hero section, welcome message |
| `about.html` | Church history, vision, mission, lead pastor bio |
| `services.html` | Weekly service schedule |
| `ministries.html` | List of ministries |
| `events.html` | Upcoming events |
| `sermons.html` | Sermon archive (YouTube links, audio, notes) |
| `gallery.html` | Photo gallery, filterable by tag |
| `articles.html` | List of published articles/blog posts |
| `article.html` | Single article view (reads `?slug=` from the URL) |
| `contact.html` | Contact info and location |
| `login.html` | Member/admin login |
| `register.html` | Member sign-up |
| `dashboard.html` | Logged-in member's account page — profile + their bookings |
| `book-camp.html` | Prayer camp registration form (guest or logged-in) |
| `booking-status.html` | Public lookup of a booking by its reference number (e.g. `CMC-2026-0001`) |

### Admin pages (`public/admin/`)

All admin pages are guarded client-side by `admin/js/admin-layout.js`, which checks `localStorage` for a token and a user with `role === 'admin'`, redirecting to `/login.html` otherwise. The actual data access is still protected server-side by `requireAdmin()` in every relevant API route — the client-side check is just a UX convenience, not the security boundary.

| Page | Purpose |
|---|---|
| `admin/dashboard.html` | Overview — aggregate stats (total/pending/approved bookings, upcoming camps, recent bookings, total users) from `/api/admin-stats` |
| `admin/bookings.html` | Manage camp bookings — search, filter by status/camp, approve/decline, edit, delete, export to CSV |
| `admin/camps.html` | Create/edit/delete prayer camps, open/close registration, set capacity |
| `admin/content.html` | Manage services, ministries, events, sermons, and articles (shared CRUD UI backed by `/api/content`) |

---

## 3. Authentication & Authorization

### How it works

1. **Register** (`POST /api/auth/register`) — hashes the password with bcrypt, inserts into `users` with `role = 'user'`, and returns a signed JWT.
2. **Login** (`POST /api/auth/login`) — looks up the user by email, compares the password hash, and returns a signed JWT.
3. The frontend stores the token in `localStorage` as `cmc_token` and the user object as `cmc_user` (see `public/js/api.js`).
4. Every subsequent authenticated request sends `Authorization: Bearer <token>`.
5. Server-side, `lib/auth.js` provides:
   - `requireAuth(req, res)` — any logged-in user (member or admin)
   - `requireAdmin(req, res)` — logged-in **and** `role === 'admin'`

Tokens expire after **7 days** (`JWT_EXPIRY` in `lib/auth.js`).

### Roles

There are exactly two roles, stored on the `users.role` column: `user` and `admin`. There is no self-service way to become an admin — see [Creating the First Admin](README.md#creating-the-first-admin) in the README.

### Guest bookings

Camp bookings do **not** require login. A booking made while logged out has `user_id = null`. If that same person later creates an account or logs in, they can "claim" the booking by reference number via `POST /api/my-bookings` with `{ action: 'claim', booking_ref }`, which links it to their account.

---

## 4. Database Schema

Defined in full in `schema.sql`. Run it in the Supabase SQL Editor to provision everything below. It's also safe to re-run against a database that's already been provisioned — `create table` statements no-op if the table exists, and any `alter table ... add column if not exists` statements at the bottom of the file backfill columns added in later revisions of the schema (e.g. `church_info.about_preview_image_url`) without affecting existing data.

### Tables

| Table | Purpose |
|---|---|
| `users` | Member and admin accounts (custom auth, not Supabase Auth) |
| `church_info` | Single-row table (`id = 1`) holding church-wide settings: name, slogan, welcome message, history/vision/mission, pastor bio, homepage about-preview image, contact info, social links |
| `services` | Weekly service schedule entries |
| `ministries` | Ministry listings |
| `events` | Upcoming/past events |
| `sermons` | Sermon archive entries (YouTube link, optional audio/notes files) |
| `gallery` | Photo gallery entries with tag arrays |
| `articles` | Blog/article posts with auto-generated unique slugs |
| `prayer_camps` | Camp definitions (dates, venue, capacity, registration open/closed) |
| `camp_bookings` | Individual registrations against a camp |

### Notable database logic

- **`generate_booking_ref()` trigger** — auto-generates human-friendly references like `CMC-2026-0001` on insert, using a Postgres sequence.
- **`enforce_camp_capacity()` trigger** — uses a Postgres advisory lock (`pg_advisory_xact_lock`) keyed on `camp_id` so two simultaneous booking requests for the same camp can't both slip through and overbook it. Rejects the insert if the camp is closed or full.
- **`touch_updated_at()` trigger** — auto-updates `updated_at` on every relevant table on `UPDATE`.
- **`camp_availability` view** — joins `prayer_camps` with a live count of `Pending`/`Approved` bookings to compute `taken_spaces` and `available_spaces`. This is what powers the "X spots left" display on the public booking page. It intentionally runs with the view owner's privileges (not `security_invoker`) so the aggregate count works even for anonymous visitors, since `camp_bookings` itself has no public read policy.
- **Row Level Security** is enabled on every table. Public tables (`church_info`, `services`, `ministries`, `events`, `sermons`, `gallery`, `articles`, `prayer_camps`) have `SELECT`-only public policies filtered to published/active rows. `users` and `camp_bookings` have **no public policies at all** — they are only ever touched through the API using the service_role key, which bypasses RLS entirely. The RLS policies exist purely as a safety net in case the anon key ever leaks.

---

## 5. API Reference

All endpoints live under `/api` and are implemented as individual Vercel serverless functions. All responses are JSON. All functions call `applyCors()` first, which handles `OPTIONS` preflight and sets CORS headers (`ALLOWED_ORIGIN` env var, defaults to `*`).

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create a member account. Body: `full_name`, `email`, `password` (min 8 chars). Returns `{ token, user }`. |
| POST | `/api/auth/login` | — | Log in. Body: `email`, `password`. Returns `{ token, user }`. |

### Bookings (`api/bookings.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/bookings?ref=CMC-2026-0001` | — | Public lookup of a single booking by reference (for the confirmation/status page). Returns limited, non-sensitive fields. |
| GET | `/api/bookings` | admin | List all bookings. Supports `?status=`, `?camp_id=`, `?search=` (matches name, email, phone, or reference). |
| GET | `/api/bookings?id=uuid` | admin | Single booking by internal ID. |
| POST | `/api/bookings` | optional | Create a booking. Works for guests or logged-in users (if a valid token is present, `user_id` is set automatically). Required body fields: `camp_id`, `full_name`, `phone_number`, `email`, `emergency_contact`. Optional: `gender`, `date_of_birth`, `prayer_request`, `additional_notes`. Rejected if the camp is closed or full (enforced at the database level). |
| PUT | `/api/bookings?id=uuid` | admin | Update a booking's status or details (e.g. approve/decline). |
| DELETE | `/api/bookings?id=uuid` | admin | Delete a booking. |

### My Bookings (`api/my-bookings.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/my-bookings` | member | All bookings linked to the logged-in user's `user_id`. |
| GET | `/api/my-bookings?id=uuid` | member | A single booking, only if it belongs to the logged-in user. |
| POST | `/api/my-bookings` | member | Body: `{ action: 'claim', booking_ref }` — links a guest booking to the logged-in account. |

### Camps (`api/camps.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/camps` | — | Public list of camps, including live availability (from the `camp_availability` view). |
| GET | `/api/camps?id=uuid` | — | Single camp with availability. |
| POST | `/api/camps` | admin | Create a camp. Fields: `name`, `description`, `start_date`, `end_date`, `venue`, `max_participants`, `registration_open`, `cover_image_url`. |
| PUT | `/api/camps?id=uuid` | admin | Update a camp (dates, capacity, open/close registration, etc.). |
| DELETE | `/api/camps?id=uuid` | admin | Delete a camp (cascades to its bookings). |

### Content (`api/content.js`)

A single consolidated CRUD endpoint (to stay under Vercel's per-project function count limits) that handles five different content types, routed by a `?type=` query param.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/content?type=services\|ministries\|events\|sermons\|articles` | — (public rows only) / admin (all rows) | List content of the given type. |
| POST | `/api/content?type=...` | admin | Create an item of that type. |
| PUT | `/api/content?type=...&id=uuid` | admin | Update an item. |
| DELETE | `/api/content?type=...&id=uuid` | admin | Delete an item. |

Notes:
- `articles` auto-generates a unique URL `slug` from the title on creation (appending a short timestamp suffix if the slug already exists).
- Each type has its own `allowedFields` whitelist server-side, so arbitrary columns can't be written via the API.

### Gallery (`api/gallery.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/gallery` | — | List all gallery images, ordered by `display_order`. |
| GET | `/api/gallery?tag=youth` | — | Filter by tag. |
| GET | `/api/gallery?id=uuid` | — | Single image. |
| POST | `/api/gallery` | admin | Add an image. |
| PUT | `/api/gallery?id=uuid` | admin | Update caption/tags/order. |
| DELETE | `/api/gallery?id=uuid` | admin | Remove an image. |

### Church Info (`api/church-info.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/church-info` | — | Public church settings (name, slogan, bio, contact, social links). |
| PUT | `/api/church-info` | admin | Update church settings. |

### Profile (`api/profile.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | member | The logged-in user's own profile. |
| PUT | `/api/profile` | member | Update own profile. Allowed fields: `full_name`, `phone`, `gender`, `date_of_birth`, `emergency_contact`. The user ID always comes from the verified JWT, never from the request body, so users can only ever edit themselves. |

### Admin Stats (`api/admin-stats.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin-stats` | admin | Aggregate counts powering the admin overview page: total bookings, pending bookings, approved bookings, upcoming camps, recent bookings, total registered users. |

### Upload (`api/upload.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/upload` | admin | Upload a file. Body: `{ file_name, file_base64, content_type, bucket }`. `bucket` must be one of `gallery`, `sermons`, `events`, `articles`, `church-assets`. Returns the public Supabase Storage URL. |
| DELETE | `/api/upload` | admin | Body: `{ url }` — deletes the file at that public Supabase Storage URL. |

### Setup Admin (`api/setup-admin.js`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/setup-admin` | `SETUP_SECRET` | One-time bootstrap endpoint to create the first admin account. See the README's [Creating the First Admin](README.md#creating-the-first-admin) section. Disable by unsetting `SETUP_SECRET` (or deleting the file) once used. |

---

## 6. File Uploads

Images and files (gallery photos, sermon audio/notes, article cover images, etc.) are uploaded through a single flow:

1. The admin picks a file in the browser.
2. `public/admin/js/upload-helper.js` reads it and base64-encodes it client-side (max 25MB).
3. It POSTs `{ file_name, file_base64, content_type, bucket }` to `/api/upload`.
4. The serverless function (admin-only) uploads the decoded file to the specified Supabase Storage bucket and returns the public URL.
5. That URL is saved into the relevant table column (e.g. `gallery.image_url`, `sermons.cover_image_url`).

Deleting a file works the same way in reverse — the API parses the bucket and path back out of the public Supabase URL and removes the object from Storage.

**Required setup:** the five buckets (`gallery`, `sermons`, `events`, `articles`, `church-assets`) must exist in Supabase Storage and be set to public, or uploaded files won't be viewable on the site.

---

## 7. Admin Dashboard Guide

Reached at `/admin/dashboard.html` after logging in with an admin account.

- **Overview** (`dashboard.html`) — snapshot stats: total/pending/approved bookings, upcoming camps, recent bookings, and total registered users.
- **Camp Bookings** (`bookings.html`) — the operational heart of the booking system:
  - Search by name, email, phone, or reference.
  - Filter by status (Pending/Approved/Declined) and by camp.
  - Approve or decline a booking with one click.
  - Edit any booking's details (contact info, emergency contact, prayer request, notes, status) in a modal.
  - Delete a booking.
  - **Export CSV** — exports the currently filtered/visible list of bookings to a downloadable CSV file (respects the active search/status/camp filters).
- **Prayer Camps** (`camps.html`) — create camps, set dates/venue/capacity, open or close registration. Availability (spaces left) is computed live from actual bookings, not manually tracked.
- **Website Content** (`content.html`) — a single management screen (tabbed or sectioned) for services, ministries, events, sermons, and articles, all backed by the shared `/api/content` endpoint. Includes image/file upload for each content type where relevant (e.g. sermon audio, article cover images).

---

## 8. Shared Frontend Utilities

### `public/js/api.js`
Used on every public and member page. Provides:
- `api(path, { method, body, auth })` — a thin `fetch` wrapper that adds the JSON content-type header, attaches the bearer token when `auth: true`, parses the JSON response, and throws a normal `Error` with the server's message on non-2xx responses.
- `getToken()` / `setToken()` / `clearToken()` — read/write the JWT in `localStorage` under `cmc_token`.
- `getStoredUser()` / `setStoredUser()` — read/write the cached user object under `cmc_user`.
- `showToast(message, type)` — a small toast notification used for success/error feedback across the site.
- `formatDate(dateStr)` — formats an ISO date as e.g. "17 August 2026".

### `public/js/layout.js`
Renders the shared public-site header/navigation and footer, and adjusts the nav based on whether a user is logged in (showing "My Account" linking to `/dashboard.html` for members or `/admin/dashboard.html` for admins, vs. "Log In" otherwise).

### `public/admin/js/admin-layout.js`
- **Auth guard**: on every admin page load, checks `localStorage` for a token and a user with `role === 'admin'`; redirects to `/login.html` if either check fails.
- Renders the shared admin sidebar/navigation.

### `public/admin/js/upload-helper.js`
- `fileToBase64(file)` — reads a `File` object into a base64 string.
- `uploadFile(file, bucket)` — enforces the 25MB size limit, base64-encodes the file, and posts it to `/api/upload`, returning the public URL.

---

## 9. Conventions & Patterns

- **No build tooling anywhere.** Pages are meant to be edited directly (including via the GitHub web editor) and deployed with no compile/bundle step.
- **Field whitelisting.** Every writable API endpoint defines an explicit `allowedFields` (or equivalent) array server-side, so a request body can never write to a column that wasn't intended to be user-editable (e.g. a booking can't be POSTed with an arbitrary `status`, and a user can't PATCH their own `role`).
- **HTML escaping.** All frontend rendering of user- or admin-supplied text goes through an `escapeHtml()` helper before being inserted via `innerHTML`, to prevent stored XSS from booking forms, article content, etc.
- **CORS.** Every API function calls `applyCors(req, res)` first; it returns `true` (and the caller returns immediately) for `OPTIONS` preflight requests.
- **Errors.** API errors are always returned as `{ error: "message" }` with an appropriate HTTP status code; the frontend `api()` helper turns these into thrown `Error` objects with that message.
