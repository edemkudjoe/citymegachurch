-- ============================================================
-- CITY MEGA CHURCH — Supabase Schema
-- Run this entire file once in Supabase SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- USERS / PROFILES
-- We manage auth ourselves (JWT + bcrypt, like BizTrack) rather
-- than using Supabase Auth, so we need our own users table.
-- ============================================================
create table users (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text unique not null,
  phone text,
  password_hash text not null,
  role text not null default 'user' check (role in ('user','admin')),
  gender text check (gender in ('Male','Female','Other')),
  date_of_birth date,
  emergency_contact text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_users_email on users(email);
create index idx_users_role on users(role);

-- ============================================================
-- CHURCH INFO (single row, general settings)
-- ============================================================
create table church_info (
  id int primary key default 1,
  church_name text not null default 'City Mega Church',
  slogan text default 'Building Lives, Transforming Cities',
  hero_image_url text,
  hero_video_url text,
  welcome_message text,
  history text,
  vision text,
  mission text,
  core_values text[], -- array of value strings
  lead_pastor_name text,
  lead_pastor_bio text,
  lead_pastor_image_url text,
  about_preview_image_url text,
  address text,
  phone text,
  email text,
  google_maps_embed_url text,
  facebook_url text,
  instagram_url text,
  twitter_url text,
  youtube_url text,
  tiktok_url text,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into church_info (id) values (1);

-- ============================================================
-- SERVICES (weekly schedule)
-- ============================================================
create table services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,             -- e.g. "Sunday First Service"
  day_of_week text not null,      -- e.g. "Sunday"
  time text not null,             -- e.g. "8:00 AM"
  venue text,
  description text,
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- MINISTRIES
-- ============================================================
create table ministries (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  image_url text,
  leader_name text,
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- EVENTS
-- ============================================================
create table events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  event_date date not null,
  event_time text,
  venue text,
  description text,
  image_url text,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_date on events(event_date);

-- ============================================================
-- SERMONS
-- ============================================================
create table sermons (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  speaker text,
  sermon_date date,
  youtube_url text,
  audio_url text,         -- Supabase Storage URL, optional
  notes_url text,         -- Supabase Storage URL (PDF/doc), optional
  cover_image_url text,
  description text,
  is_published boolean default true,
  created_at timestamptz default now()
);

create index idx_sermons_date on sermons(sermon_date desc);

-- ============================================================
-- GALLERY
-- ============================================================
create table gallery (
  id uuid primary key default uuid_generate_v4(),
  image_url text not null,
  caption text,
  tags text[],             -- e.g. {'youth','worship','2026'}
  display_order int default 0,
  created_at timestamptz default now()
);

create index idx_gallery_tags on gallery using gin(tags);

-- ============================================================
-- ARTICLES (admin-managed content, with pictures)
-- ============================================================
create table articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text unique not null,
  content text not null,
  cover_image_url text,
  author_name text,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PRAYER CAMPS
-- ============================================================
create table prayer_camps (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  venue text,
  max_participants int not null default 100,
  registration_open boolean default true,
  cover_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CAMP BOOKINGS
-- ============================================================
create table camp_bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_ref text unique not null,        -- e.g. "CMC-2026-0001", human-friendly
  camp_id uuid not null references prayer_camps(id) on delete cascade,
  user_id uuid references users(id) on delete set null,  -- nullable: guest bookings allowed

  full_name text not null,
  phone_number text not null,
  email text not null,
  gender text check (gender in ('Male','Female','Other')),
  date_of_birth date,
  emergency_contact text not null,
  prayer_request text,
  additional_notes text,

  status text not null default 'Pending' check (status in ('Pending','Approved','Declined')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_bookings_camp on camp_bookings(camp_id);
create index idx_bookings_user on camp_bookings(user_id);
create index idx_bookings_status on camp_bookings(status);
create index idx_bookings_ref on camp_bookings(booking_ref);

-- ============================================================
-- BOOKING REFERENCE GENERATOR
-- Produces refs like CMC-2026-0001, sequential per year
-- ============================================================
create sequence if not exists booking_ref_seq;

create or replace function generate_booking_ref()
returns trigger as $$
declare
  yr text := to_char(now(), 'YYYY');
  seq_val int;
begin
  seq_val := nextval('booking_ref_seq');
  new.booking_ref := 'CMC-' || yr || '-' || lpad(seq_val::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_booking_ref
before insert on camp_bookings
for each row
when (new.booking_ref is null or new.booking_ref = '')
execute function generate_booking_ref();

-- ============================================================
-- CAPACITY GUARD
-- Prevents overbooking under concurrent requests: re-checks
-- available space inside the same transaction as the insert,
-- using an advisory lock on the camp_id so two simultaneous
-- bookings can't both pass the check.
-- ============================================================
create or replace function enforce_camp_capacity()
returns trigger as $$
declare
  max_p int;
  taken int;
  is_open boolean;
begin
  -- Serialize concurrent inserts for the same camp
  perform pg_advisory_xact_lock(hashtext(new.camp_id::text));

  select max_participants, registration_open into max_p, is_open
  from prayer_camps where id = new.camp_id;

  if max_p is null then
    raise exception 'Camp not found.';
  end if;
  if not is_open then
    raise exception 'Registration for this camp is closed.';
  end if;

  select count(*) into taken
  from camp_bookings
  where camp_id = new.camp_id and status in ('Pending','Approved');

  if taken >= max_p then
    raise exception 'This camp is fully booked.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_camp_capacity
before insert on camp_bookings
for each row
execute function enforce_camp_capacity();

-- ============================================================
-- updated_at auto-touch trigger (reusable)
-- ============================================================
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated before update on users
  for each row execute function touch_updated_at();
create trigger trg_events_updated before update on events
  for each row execute function touch_updated_at();
create trigger trg_articles_updated before update on articles
  for each row execute function touch_updated_at();
create trigger trg_camps_updated before update on prayer_camps
  for each row execute function touch_updated_at();
create trigger trg_bookings_updated before update on camp_bookings
  for each row execute function touch_updated_at();
create trigger trg_church_info_updated before update on church_info
  for each row execute function touch_updated_at();

-- ============================================================
-- VIEW: camp availability (spaces left)
-- Includes all prayer_camps columns directly (no embedding needed
-- from the API layer, since this is a view without FK metadata).
-- ============================================================
create or replace view camp_availability as
select
  c.id,
  c.name,
  c.description,
  c.start_date,
  c.end_date,
  c.venue,
  c.cover_image_url,
  c.max_participants,
  c.registration_open,
  c.created_at,
  c.updated_at,
  count(b.id) filter (where b.status in ('Pending','Approved')) as taken_spaces,
  c.max_participants - count(b.id) filter (where b.status in ('Pending','Approved')) as available_spaces
from prayer_camps c
left join camp_bookings b on b.camp_id = c.id
group by c.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- Since auth is handled in our own API (not Supabase Auth),
-- API calls use the service_role key which bypasses RLS.
-- We still enable RLS + define safe read-only public policies
-- as defense-in-depth, in case the anon key is ever exposed.
-- ============================================================
alter table church_info enable row level security;
alter table services enable row level security;
alter table ministries enable row level security;
alter table events enable row level security;
alter table sermons enable row level security;
alter table gallery enable row level security;
alter table articles enable row level security;
alter table prayer_camps enable row level security;
alter table camp_bookings enable row level security;
alter table users enable row level security;

-- Public read access to public-facing content only
create policy "public read church_info" on church_info for select using (true);
create policy "public read services" on services for select using (is_active = true);
create policy "public read ministries" on ministries for select using (is_active = true);
create policy "public read events" on events for select using (is_published = true);
create policy "public read sermons" on sermons for select using (is_published = true);
create policy "public read gallery" on gallery for select using (true);
create policy "public read articles" on articles for select using (is_published = true);
create policy "public read camps" on prayer_camps for select using (true);

-- camp_availability is a view owned by the table owner (not created with
-- security_invoker), so by default it runs with the owner's privileges and
-- bypasses RLS on the underlying camp_bookings table — this is required
-- for the count() aggregate to work for anon/public visitors checking
-- camp availability. Grant explicit select to expose it publicly.
grant select on camp_availability to anon, authenticated;

-- No public policies on users or camp_bookings — those are only
-- ever touched via the API using the service_role key.

-- ============================================================
-- SEED: default admin note
-- Admin user is NOT created here — create it via the
-- /api/setup-admin endpoint (one-time, then remove/disable it).
-- ============================================================

-- ============================================================
-- MIGRATION SAFETY NET
-- If this file is being re-run against a database that was
-- already provisioned from an earlier version of this schema
-- (before about_preview_image_url existed on church_info),
-- the create table step above is skipped since the table
-- already exists. This statement backfills the column in that
-- case; it's a no-op on a fresh database since the column is
-- already present from the create table statement.
-- ============================================================
alter table church_info add column if not exists about_preview_image_url text;
