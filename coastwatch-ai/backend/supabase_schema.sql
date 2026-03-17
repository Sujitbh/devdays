-- PelicanEye / CoastWatch AI - Supabase schema (public)
-- Run this in Supabase SQL Editor (Database → SQL Editor).

create table if not exists public.detections (
  id text primary key,
  user_id text not null default '',
  species text not null,
  count integer not null,
  confidence double precision not null,
  "habitatType" text not null,
  "nestingDetected" boolean not null,
  notes text not null,
  threats jsonb not null default '[]'::jsonb,
  lat double precision not null,
  lng double precision not null,
  timestamp timestamptz not null,
  "imageUrl" text not null,
  "annotatedImageUrl" text not null,
  "boundingBoxes" jsonb not null default '[]'::jsonb,
  conservation_priority text not null,
  recommended_actions jsonb not null default '[]'::jsonb,
  spatial_clusters jsonb not null default '[]'::jsonb,
  colony_health_score jsonb,
  life_stages jsonb not null default '{}'::jsonb,
  colony_site text
);

create index if not exists detections_timestamp_idx on public.detections (timestamp desc);
create index if not exists detections_user_id_idx on public.detections (user_id);

create table if not exists public.alerts (
  id text primary key,
  timestamp timestamptz not null,
  resolved boolean not null default false,
  severity text not null,
  category text not null,
  title text not null,
  location text not null,
  description text not null,
  action text not null,
  species text,
  "detectionId" text,
  notes text
);

create index if not exists alerts_timestamp_idx on public.alerts (timestamp desc);
create index if not exists alerts_resolved_idx on public.alerts (resolved);
create index if not exists alerts_severity_idx on public.alerts (severity);

-- Users table for persistent auth (replaces ephemeral users.db on Railway)
create table if not exists public.users (
  id text primary key,
  full_name text not null,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null
);

-- Case-insensitive uniqueness for email
create unique index if not exists users_email_lower_unique on public.users ((lower(email)));

-- For a quick demo, you can disable RLS (default). If you enable RLS later,
-- use a service role key on the backend or add appropriate policies.

