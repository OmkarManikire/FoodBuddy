-- 001_initial_schema.sql
-- Food Buddy Stage 1 Initial Schema
-- Tables: valid_student_ids, profiles, login_otps

-- 1. Valid Student IDs table (institutional pre-approved list)
create table if not exists public.valid_student_ids (
    student_id text primary key,
    used boolean not null default false,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

-- 2. Profiles table (Student, Mess Manager, Higher Authority)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    email text not null,
    role text not null check (role in ('student', 'mess_manager', 'authority')),
    student_id text unique,
    room_no text,
    hostel_block text,
    otp_verified_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Login & Reset OTPs table (server-only storage, hashed OTPs)
create table if not exists public.login_otps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    otp_hash text not null,
    expires_at timestamptz not null,
    attempts integer not null default 0,
    last_sent_at timestamptz not null default now(),
    purpose text not null check (purpose in ('login', 'reset')),
    created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_student_id on public.profiles(student_id);
create index if not exists idx_login_otps_user_purpose on public.login_otps(user_id, purpose);
create index if not exists idx_login_otps_expires on public.login_otps(expires_at);

-- Enable RLS on every table (deny by default)
alter table public.valid_student_ids enable row level security;
alter table public.profiles enable row level security;
alter table public.login_otps enable row level security;
