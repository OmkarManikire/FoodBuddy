-- 003_rls_policies.sql
-- Food Buddy Row Level Security (RLS) Policies
-- Strict Deny-by-Default on all tables

-- ----------------------------------------------------
-- 1. Table: valid_student_ids
-- Server-only access. No client policies defined.
-- Read/updated solely via handle_new_user() trigger and seed script.
-- ----------------------------------------------------

-- ----------------------------------------------------
-- 2. Table: login_otps
-- Server-only access. No client policies defined.
-- Managed solely via Edge Functions with service role.
-- ----------------------------------------------------

-- ----------------------------------------------------
-- 3. Table: profiles
-- Client access requires authentication AND is_verified_user()
-- ----------------------------------------------------

-- Policy: Verified users can view their own profile
create policy "Verified users can view own profile"
on public.profiles
for select
to authenticated
using (
    auth.uid() = id and is_verified_user()
);

-- Policy: Verified students can update their own room/contact info
create policy "Verified users can update own contact info"
on public.profiles
for update
to authenticated
using (
    auth.uid() = id and is_verified_user()
)
with check (
    auth.uid() = id and is_verified_user()
);

-- Policy: Verified Mess Managers and Authorities can view all profiles
create policy "Verified staff can view all profiles"
on public.profiles
for select
to authenticated
using (
    is_verified_user() and get_user_role() in ('mess_manager', 'authority')
);
