-- ==========================================================
-- Migration 005: Food Buddy Student Dashboard Schema, RPC & RLS
-- ==========================================================

-- 1. RATINGS TABLE
create table if not exists public.ratings (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete cascade,
    date date not null default current_date,
    meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner')),
    food_rating int not null check (food_rating between 1 and 5),
    staff_rating int check (staff_rating between 1 and 5),
    hygiene_rating int check (hygiene_rating between 1 and 5),
    comment text,
    created_at timestamptz not null default now(),
    constraint unique_student_meal_date unique(student_id, date, meal_slot)
);

create index if not exists idx_ratings_student_date on public.ratings(student_id, date);
alter table public.ratings enable row level security;

-- 2. MENU TABLE
create table if not exists public.menu (
    id uuid primary key default gen_random_uuid(),
    date date not null,
    meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner')),
    title text not null,
    items jsonb not null default '[]'::jsonb,
    timing text not null,
    special boolean not null default false,
    calories int default 450,
    created_at timestamptz not null default now(),
    constraint unique_menu_slot_date unique(date, meal_slot)
);

create index if not exists idx_menu_date_slot on public.menu(date, meal_slot);
alter table public.menu enable row level security;

-- Enable Realtime on menu table
alter publication supabase_realtime add table public.menu;

-- 3. COMPLAINTS & HISTORY
create sequence if not exists public.complaint_tracking_seq start 101;

create table if not exists public.complaints (
    id uuid primary key default gen_random_uuid(),
    tracking_id text not null unique,
    student_id uuid not null references public.profiles(id) on delete cascade,
    category text not null check (category in ('Food Quality', 'Hygiene', 'Staff Behaviour', 'Infrastructure', 'Other')),
    description text not null,
    media_paths text[] default array[]::text[],
    status text not null default 'submitted' check (status in ('submitted', 'under_review', 'in_progress', 'resolved', 'rejected')),
    escalated boolean not null default false,
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolution_note text
);

create index if not exists idx_complaints_student on public.complaints(student_id);
create index if not exists idx_complaints_status on public.complaints(status);
alter table public.complaints enable row level security;

create table if not exists public.complaint_history (
    id uuid primary key default gen_random_uuid(),
    complaint_id uuid not null references public.complaints(id) on delete cascade,
    status text not null,
    note text not null,
    actor_role text not null default 'student',
    changed_at timestamptz not null default now()
);

create index if not exists idx_complaint_history_cid on public.complaint_history(complaint_id);
alter table public.complaint_history enable row level security;

-- 4. SUGGESTIONS (FOOD IMPROVEMENT) TABLE
create table if not exists public.suggestions (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete cascade,
    category text not null,
    title text not null,
    suggestion text not null,
    votes int not null default 0,
    status text not null default 'submitted' check (status in ('submitted', 'under_consideration', 'accepted', 'planned')),
    created_at timestamptz not null default now()
);

create index if not exists idx_suggestions_student on public.suggestions(student_id);
alter table public.suggestions enable row level security;

-- 5. NOTICES & NOTICE READS TABLE
create table if not exists public.notices (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    posted_by text not null check (posted_by in ('mess_manager', 'authority')),
    author_name text not null,
    priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent', 'critical')),
    expires_at timestamptz,
    is_archived boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_notices_active on public.notices(created_at desc) where is_archived = false;
alter table public.notices enable row level security;

create table if not exists public.notice_reads (
    notice_id uuid not null references public.notices(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    read_at timestamptz not null default now(),
    primary key (notice_id, user_id)
);

alter table public.notice_reads enable row level security;

-- 6. QR SESSIONS & ATTENDANCE TABLE
create table if not exists public.qr_sessions (
    id uuid primary key default gen_random_uuid(),
    token text not null unique,
    meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner')),
    date date not null default current_date,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.qr_sessions enable row level security;

create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.profiles(id) on delete cascade,
    meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner')),
    date date not null default current_date,
    scanned_at timestamptz not null default now(),
    constraint unique_attendance_student_slot_date unique (student_id, meal_slot, date)
);

create index if not exists idx_attendance_student_date on public.attendance(student_id, date);
alter table public.attendance enable row level security;

-- ==========================================================
-- 7. RPC FUNCTIONS
-- ==========================================================

-- RPC: create_complaint
create or replace function public.create_complaint(
    p_category text,
    p_description text,
    p_media_paths text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_role text;
    v_hourly_count int;
    v_tracking_id text;
    v_complaint_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required.');
    end if;

    if not public.is_verified_user() then
        return jsonb_build_object('success', false, 'error', 'OTP verification required.');
    end if;

    v_role := public.get_user_role();
    if v_role != 'student' then
        return jsonb_build_object('success', false, 'error', 'Only students can file dining complaints.');
    end if;

    -- Rate limit: max 5 complaints per hour per student
    select count(*) into v_hourly_count
    from public.complaints
    where student_id = v_uid
      and created_at > now() - interval '1 hour';

    if v_hourly_count >= 5 then
        return jsonb_build_object('success', false, 'error', 'Rate limit exceeded: You can submit at most 5 complaints per hour.');
    end if;

    -- Generate tracking ID: FB-YYYY-XXXXX
    v_tracking_id := 'FB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.complaint_tracking_seq')::text, 5, '0');
    v_complaint_id := gen_random_uuid();

    insert into public.complaints (
        id, tracking_id, student_id, category, description, media_paths, status, created_at
    ) values (
        v_complaint_id, v_tracking_id, v_uid, p_category, p_description, coalesce(p_media_paths, array[]::text[]), 'submitted', now()
    );

    insert into public.complaint_history (
        complaint_id, status, note, actor_role, changed_at
    ) values (
        v_complaint_id, 'submitted', 'Ticket registered by student', 'student', now()
    );

    return jsonb_build_object(
        'success', true,
        'complaint_id', v_complaint_id,
        'tracking_id', v_tracking_id
    );
end;
$$;

-- RPC: mark_attendance
create or replace function public.mark_attendance(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_session record;
    v_already_marked boolean;
    v_attendance_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required.');
    end if;

    if not public.is_verified_user() then
        return jsonb_build_object('success', false, 'error', 'OTP verification required.');
    end if;

    if public.get_user_role() != 'student' then
        return jsonb_build_object('success', false, 'error', 'Only students can record meal attendance.');
    end if;

    -- Validate QR session token and expiration
    select * into v_session
    from public.qr_sessions
    where token = trim(p_token);

    if not found then
        return jsonb_build_object('success', false, 'error', 'Invalid QR code. Please scan the current code displayed at the mess counter.');
    end if;

    if v_session.expires_at <= now() then
        return jsonb_build_object('success', false, 'error', 'This QR code has expired. Please scan the newly generated turnstile code.');
    end if;

    -- Check for duplicate scan
    select exists (
        select 1 from public.attendance
        where student_id = v_uid
          and meal_slot = v_session.meal_slot
          and date = v_session.date
    ) into v_already_marked;

    if v_already_marked then
        return jsonb_build_object(
            'success', false,
            'already_marked', true,
            'meal_slot', v_session.meal_slot,
            'date', v_session.date,
            'error', 'Attendance already marked for ' || initcap(v_session.meal_slot) || ' on ' || to_char(v_session.date, 'DD Mon YYYY') || '.'
        );
    end if;

    -- Insert attendance record
    insert into public.attendance (
        student_id, meal_slot, date, scanned_at
    ) values (
        v_uid, v_session.meal_slot, v_session.date, now()
    ) returning id into v_attendance_id;

    return jsonb_build_object(
        'success', true,
        'attendance_id', v_attendance_id,
        'meal_slot', initcap(v_session.meal_slot),
        'date', to_char(v_session.date, 'DD Mon YYYY'),
        'scanned_at', to_char(now(), 'HH12:MI AM')
    );
end;
$$;

-- RPC: mark_notice_as_read
create or replace function public.mark_notice_as_read(p_notice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null then
        insert into public.notice_reads (notice_id, user_id, read_at)
        values (p_notice_id, auth.uid(), now())
        on conflict (notice_id, user_id) do update set read_at = now();
        return jsonb_build_object('success', true);
    end if;
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
end;
$$;

-- RPC: get_student_kpis
create or replace function public.get_student_kpis()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_meals_attended int;
    v_open_complaints int;
    v_ratings_given int;
    v_unread_notices int;
    v_active_ticket record;
begin
    v_uid := auth.uid();
    if v_uid is null or not public.is_verified_user() then
        return jsonb_build_object('success', false, 'error', 'Unauthorized');
    end if;

    -- Meals attended this calendar month
    select count(*) into v_meals_attended
    from public.attendance
    where student_id = v_uid
      and date >= date_trunc('month', current_date);

    -- Open complaints (submitted, under_review, in_progress)
    select count(*) into v_open_complaints
    from public.complaints
    where student_id = v_uid
      and status in ('submitted', 'under_review', 'in_progress');

    -- Ratings given this week (Monday to Sunday)
    select count(*) into v_ratings_given
    from public.ratings
    where student_id = v_uid
      and date >= date_trunc('week', current_date);

    -- Unread notices count (active notices not in notice_reads)
    select count(*) into v_unread_notices
    from public.notices n
    where n.is_archived = false
      and (n.expires_at is null or n.expires_at > now())
      and not exists (
          select 1 from public.notice_reads nr
          where nr.notice_id = n.id and nr.user_id = v_uid
      );

    -- Latest active ticket details (for card display)
    select tracking_id, status into v_active_ticket
    from public.complaints
    where student_id = v_uid
      and status in ('submitted', 'under_review', 'in_progress')
    order by created_at desc
    limit 1;

    return jsonb_build_object(
        'success', true,
        'meals_attended', v_meals_attended,
        'open_complaints', v_open_complaints,
        'active_ticket_id', coalesce(v_active_ticket.tracking_id, 'None'),
        'active_ticket_status', coalesce(v_active_ticket.status, 'None'),
        'ratings_given', v_ratings_given,
        'unread_notices', v_unread_notices
    );
end;
$$;

-- ==========================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- RATINGS:
-- Student can only select their own ratings
create policy "student_view_own_ratings"
on public.ratings for select
using (
    public.is_verified_user()
    and student_id = auth.uid()
);

-- Student can only insert their own ratings
create policy "student_insert_own_ratings"
on public.ratings for insert
with check (
    public.is_verified_user()
    and public.get_user_role() = 'student'
    and student_id = auth.uid()
);

-- MENU:
-- Any verified user (student, manager, authority) can read menu
create policy "verified_users_read_menu"
on public.menu for select
using (
    public.is_verified_user()
);

-- COMPLAINTS:
-- Student can view only their own complaints
create policy "student_view_own_complaints"
on public.complaints for select
using (
    public.is_verified_user()
    and student_id = auth.uid()
);

-- COMPLAINT HISTORY:
-- Student can view history for only their own complaints
create policy "student_view_own_complaint_history"
on public.complaint_history for select
using (
    public.is_verified_user()
    and exists (
        select 1 from public.complaints c
        where c.id = complaint_history.complaint_id
          and c.student_id = auth.uid()
    )
);

-- SUGGESTIONS:
-- Student can view only their own suggestions
create policy "student_view_own_suggestions"
on public.suggestions for select
using (
    public.is_verified_user()
    and student_id = auth.uid()
);

-- Student can insert own suggestions
create policy "student_insert_own_suggestions"
on public.suggestions for insert
with check (
    public.is_verified_user()
    and public.get_user_role() = 'student'
    and student_id = auth.uid()
);

-- NOTICES:
-- Verified students can view active, non-expired notices
create policy "verified_users_view_active_notices"
on public.notices for select
using (
    public.is_verified_user()
    and is_archived = false
    and (expires_at is null or expires_at > now())
);

-- NOTICE READS:
-- Student can view and insert own read receipts
create policy "student_view_own_notice_reads"
on public.notice_reads for select
using (
    user_id = auth.uid()
);

create policy "student_insert_own_notice_reads"
on public.notice_reads for insert
with check (
    user_id = auth.uid()
);

-- ATTENDANCE:
-- Student can view only their own attendance records
create policy "student_view_own_attendance"
on public.attendance for select
using (
    public.is_verified_user()
    and student_id = auth.uid()
);

-- Note: qr_sessions has ZERO client policies (Server-only table).
-- Note: attendance has NO direct client INSERT policy (Enforced via RPC mark_attendance).
