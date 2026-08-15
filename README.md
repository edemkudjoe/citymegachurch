# City Mega Church — Website & Prayer Camp Booking System

All four planned phases are complete: public site, prayer camp booking, user dashboard, and admin dashboard.

## Phase 1: Foundation
- Public website: Home, About, Services, Ministries, Events, Sermons, Gallery, Contact
- User auth: register/login (JWT + bcrypt)
- Admin auth: one-time setup endpoint
- Supabase schema: all tables for the full system
- File upload endpoint to Supabase Storage

## Phase 2: Prayer Camp Booking
- `/book-camp.html` — public camp listing (live spaces-left counts) + booking form
- `/booking-status.html` — guest-friendly lookup by booking reference, no login required
- `POST /api/bookings` — creates a booking, auto-generates a reference like `CMC-2026-0001`
- `GET /api/bookings?ref=...` — public status lookup
- `GET/POST/PUT/DELETE /api/camps` — camp CRUD (admin-only for writes; public read includes live availability)
- **Overbooking protection**: a database trigger (`enforce_camp_capacity`) re-checks capacity and registration status atomically at insert time, using an advisory lock per camp — so two people booking the last spot at the same moment can't both succeed.
- Bookings made while logged in are automatically linked to the user's account; guests can still book without an account.

## Phase 3: User Dashboard
- `/dashboard.html` — logged-in user's account: profile, bookings, status, and confirmations, in a tabbed view
  - **My Bookings tab**: every camp booking linked to the account, each with a status badge (Pending/Approved/Declined) and a "View" button that opens a printable confirmation (uses the browser's print dialog, so users can save as PDF)
  - **Profile tab**: view and edit name, phone, gender, date of birth, emergency contact (email is locked — changing it isn't self-service, by design)
  - **Claim a guest booking**: if someone booked a camp before creating an account (or while logged out), they can link it to their account by entering the booking reference — verified against a matching email, since the booking form doesn't require login
- `GET/PUT /api/profile` — a user can only ever read/write their own record; the id comes from their verified JWT, never from the request
- `GET /api/my-bookings` — bookings scoped strictly to the logged-in user (ownership double-checked server-side, not just filtered client-side); `POST /api/my-bookings` with `{ action: 'claim', booking_ref }` handles the claim flow
- All dynamically rendered user/booking data is HTML-escaped before insertion into the page — this closes a stored-XSS gap that would otherwise let a malicious booking (e.g. a name containing a script tag) execute in an admin's or the same user's browser later.

## Phase 4: Admin Dashboard
A full admin UI at `/admin/` — no need to use Supabase's table editor or raw API calls for day-to-day management.

- `/admin/dashboard.html` — overview: total/pending/approved bookings, registered users, upcoming camps, recent registrations
- `/admin/bookings.html` — all bookings in a searchable, filterable table (by name/email/phone/reference, status, camp). Approve, decline, edit, or delete any booking directly
- `/admin/camps.html` — create camps, edit dates/venue/capacity, upload a cover image, toggle registration open/closed, see live spaces remaining
- `/admin/content.html` — a single tabbed workspace for everything else:
  - **Church Info**: hero image, welcome message, history/vision/mission, core values, lead pastor bio + photo, contact details, Google Maps embed, social links
  - **Services, Ministries, Events, Sermons, Articles**: full CRUD through a shared modal form, each with the fields relevant to that content type (sermons support a YouTube link, an uploaded audio file, and uploaded notes; events and ministries support uploaded images)
  - **Gallery**: photo grid with upload + caption + comma-separated tags

All admin pages share one auth guard (`admin-layout.js`) that redirects anyone who isn't logged in as an admin straight to `/login.html`, and one sidebar shell so navigation is consistent across pages.

### API consolidation (Phase 4)
To stay within Vercel's serverless function limits, several endpoints were merged:
- `services`, `ministries`, `events`, `sermons`, and `articles` all live under one `GET/POST/PUT/DELETE /api/content?type=X` handler (`type` is one of those five values)
- Claiming a guest booking moved into `my-bookings`: `POST /api/my-bookings` with `{ action: 'claim', booking_ref }`
- New: `GET /api/admin-stats` for the dashboard overview numbers

If anything outside this codebase calls the old individual routes (`/api/services`, `/api/claim-booking`, etc.), update those calls — the old routes no longer exist.

**Function count**: this project uses exactly 12 serverless functions, the Vercel Hobby plan's limit. `api/setup-admin.js` is one of them and is only needed once — delete it after creating your admin account (see below) to free a slot for anything you add later, or upgrade to Vercel Pro if you'd rather keep it around.

## Setup

### 1. Supabase
1. Create a new Supabase project.
2. Open the SQL Editor and run the full contents of `schema.sql`.
3. Go to Storage and create these buckets (all **public**):
   - `gallery`
   - `sermons`
   - `events`
   - `articles`
   - `church-assets`
4. Copy your Project URL and `service_role` key (Settings → API).

### 2. Environment variables (set in Vercel project settings)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=generate-a-long-random-string
SETUP_SECRET=another-long-random-string-used-once
ALLOWED_ORIGIN=https://your-deployed-domain.vercel.app
```

### 3. Deploy
```
npm install
vercel deploy
```
(Or connect the GitHub repo to Vercel for auto-deploys, same as BizTrack.)

### 4. Create your admin account (one time only)
After deploying, call:
```
POST /api/setup-admin
{
  "setup_secret": "value of SETUP_SECRET",
  "full_name": "Your Name",
  "email": "admin@citymegachurch.org",
  "password": "a-strong-password"
}
```
Then log in at `/login.html` — you'll land in `/admin/dashboard.html` automatically since your account has the `admin` role. After this, remove `SETUP_SECRET` from env vars (or delete `api/setup-admin.js`) so the endpoint can never be used again.

### 5. Add your content
Everything is manageable from `/admin/content.html` and `/admin/camps.html` now — no need to touch Supabase directly for routine updates. Supabase's Table Editor is still there as a fallback if you ever need it.

## Notes
- Logo processed from your upload: black background removed, cropped tight (`public/images/logo.png`).
- Brand palette: near-black background, off-white text, violet accent (`#7C3AED`), echoing the skyline mark in the logo.
- The skyline silhouette divider (see footer) is a recurring signature element tied to your logo's step-pattern mark.
- Admin routes are protected client-side (redirect if not admin) and server-side (every write endpoint calls `requireAdmin`, which verifies the JWT and role on every request) — the client-side check is just for a clean UX, not the actual security boundary.
