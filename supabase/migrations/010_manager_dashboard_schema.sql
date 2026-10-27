-- ==========================================================
-- Migration 010: Mess Manager Dashboard Schema & Functions
-- ==========================================================

-- 1. Quality Checklists Table
create table if not exists public.quality_checklists (
    id uuid primary key default gen_random_uuid(),
    date date not null default current_date,
    meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner')),
    items jsonb not null default '[]'::jsonb,
    signed_by uuid references public.profiles(id),
    signed_at timestamptz,
    head_cook_name text,
    notes text,
    created_at timestamptz not null default now(),
    unique(date, meal_slot)
);

alter table public.quality_checklists enable row level security;

-- 2. Manager Policies on quality_checklists
create policy "quality_checklists_manager_select"
    on public.quality_checklists for select
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

create policy "quality_checklists_manager_insert"
    on public.quality_checklists for insert
    with check (public.is_verified_user() and public.get_user_role() = 'mess_manager');

create policy "quality_checklists_manager_update"
    on public.quality_checklists for update
    using (public.is_verified_user() and public.get_user_role() = 'mess_manager');

-- 3. Manager Policies on Existing Tables (Attendance, Complaints, Ratings, Menu, Notices)
-- Attendance: Managers can view all rows, no client insert/update/delete
create policy "attendance_manager_select"
    on public.attendance for select
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

-- Complaints: Managers can view all rows
create policy "complaints_manager_select"
    on public.complaints for select
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

-- Complaint History: Managers can view all rows
create policy "complaint_history_manager_select"
    on public.complaint_history for select
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

-- Ratings: Managers can view all rows
create policy "ratings_manager_select"
    on public.ratings for select
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

-- Menu: Managers can insert and update
create policy "menu_manager_insert"
    on public.menu for insert
    with check (public.is_verified_user() and public.get_user_role() = 'mess_manager');

create policy "menu_manager_update"
    on public.menu for update
    using (public.is_verified_user() and public.get_user_role() = 'mess_manager');

-- Notices: Managers can insert and update (edit / archive)
create policy "notices_manager_insert"
    on public.notices for insert
    with check (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

create policy "notices_manager_update"
    on public.notices for update
    using (public.is_verified_user() and public.get_user_role() in ('mess_manager', 'authority'));

-- 4. Enable Realtime on attendance, complaints, complaint_history
do $$
begin
    begin
        alter publication supabase_realtime add table public.attendance;
    exception when others then null;
    end;
    begin
        alter publication supabase_realtime add table public.complaints;
    exception when others then null;
    end;
    begin
        alter publication supabase_realtime add table public.complaint_history;
    exception when others then null;
    end;
end $$;

-- 5. RPC get_current_qr(p_meal_slot)
create or replace function public.get_current_qr(p_meal_slot text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_role text;
    v_target_slot text;
    v_current_hour int;
    v_active_record record;
    v_token text;
    v_expires_at timestamptz;
    v_remaining_sec int;
    v_scan_count int;
    v_date date := current_date;
begin
    v_user_id := auth.uid();
    if v_user_id is null or not public.is_verified_user() then
        raise exception 'Authentication and verification required.';
    end if;

    v_role := public.get_user_role();
    if v_role <> 'mess_manager' and v_role <> 'authority' then
        raise exception 'Access denied: Mess Manager role required.';
    end if;

    -- Determine slot
    if p_meal_slot is not null and p_meal_slot in ('breakfast', 'lunch', 'snacks', 'dinner') then
        v_target_slot := p_meal_slot;
    else
        v_current_hour := extract(hour from (now() at time zone 'Asia/Kolkata'));
        if v_current_hour >= 6 and v_current_hour < 11 then
            v_target_slot := 'breakfast';
        elsif v_current_hour >= 11 and v_current_hour < 16 then
            v_target_slot := 'lunch';
        elsif v_current_hour >= 16 and v_current_hour < 19 then
            v_target_slot := 'snacks';
        else
            v_target_slot := 'dinner';
        end if;
    end if;

    -- Check for active token with >30s remaining
    select token, expires_at
    into v_active_record
    from public.qr_sessions
    where meal_slot = v_target_slot
      and date = v_date
      and expires_at > (now() + interval '30 seconds')
      and token not like 'FB-%'
    order by expires_at desc
    limit 1;

    if v_active_record.token is not null then
        v_token := v_active_record.token;
        v_expires_at := v_active_record.expires_at;
        v_remaining_sec := greatest(0, floor(extract(epoch from (v_expires_at - now())))::int);
    else
        v_token := 'QR-' || upper(v_target_slot) || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        v_expires_at := now() + interval '150 seconds';
        v_remaining_sec := 150;

        insert into public.qr_sessions (token, meal_slot, date, expires_at)
        values (v_token, v_target_slot, v_date, v_expires_at);
    end if;

    select count(*) into v_scan_count
    from public.attendance
    where meal_slot = v_target_slot and date = v_date;

    return json_build_object(
        'token', v_token,
        'meal_slot', v_target_slot,
        'date', v_date,
        'expires_at', v_expires_at,
        'remaining_seconds', v_remaining_sec,
        'scan_count', v_scan_count
    );
end;
$$;

-- 6. RPC update_complaint_status
create or replace function public.update_complaint_status(
    p_complaint_id uuid,
    p_status text,
    p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_role text;
    v_complaint record;
begin
    v_user_id := auth.uid();
    if v_user_id is null or not public.is_verified_user() then
        raise exception 'Authentication and verification required.';
    end if;

    v_role := public.get_user_role();
    if v_role <> 'mess_manager' and v_role <> 'authority' then
        raise exception 'Access denied: Manager or Authority role required.';
    end if;

    if p_status not in ('pending', 'under_review', 'in_progress', 'resolved', 'escalated') then
        raise exception 'Invalid complaint status: %', p_status;
    end if;

    if p_status = 'resolved' and (p_note is null or trim(p_note) = '') then
        raise exception 'A resolution note is required when resolving a complaint.';
    end if;

    update public.complaints
    set status = p_status,
        resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end,
        resolution_note = case when p_status = 'resolved' then p_note else resolution_note end
    where id = p_complaint_id
    returning * into v_complaint;

    if v_complaint.id is null then
        raise exception 'Complaint not found.';
    end if;

    insert into public.complaint_history (complaint_id, status, note, changed_at)
    values (
        p_complaint_id,
        p_status,
        coalesce(p_note, 'Status changed to ' || p_status || ' by Mess Manager'),
        now()
    );

    return json_build_object(
        'success', true,
        'id', v_complaint.id,
        'tracking_id', v_complaint.tracking_id,
        'status', v_complaint.status,
        'resolved_at', v_complaint.resolved_at,
        'resolution_note', v_complaint.resolution_note
    );
end;
$$;

-- 7. RPC get_manager_overview_kpis
create or replace function public.get_manager_overview_kpis()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_role text;
    v_breakfast_count int := 0;
    v_lunch_count int := 0;
    v_snacks_count int := 0;
    v_dinner_count int := 0;
    v_pending_complaints int := 0;
    v_avg_food_today numeric := 0.0;
    v_avg_staff_today numeric := 0.0;
    v_avg_hygiene_today numeric := 0.0;
    v_total_ratings_today int := 0;
    v_oldest_complaints json;
begin
    v_user_id := auth.uid();
    if v_user_id is null or not public.is_verified_user() then
        raise exception 'Authentication and verification required.';
    end if;

    v_role := public.get_user_role();
    if v_role <> 'mess_manager' and v_role <> 'authority' then
        raise exception 'Access denied: Manager or Authority role required.';
    end if;

    select count(*) into v_breakfast_count from public.attendance where date = current_date and meal_slot = 'breakfast';
    select count(*) into v_lunch_count from public.attendance where date = current_date and meal_slot = 'lunch';
    select count(*) into v_snacks_count from public.attendance where date = current_date and meal_slot = 'snacks';
    select count(*) into v_dinner_count from public.attendance where date = current_date and meal_slot = 'dinner';

    select count(*) into v_pending_complaints
    from public.complaints
    where status in ('pending', 'under_review', 'in_progress');

    select
        coalesce(round(avg(food_rating), 1), 0.0),
        coalesce(round(avg(staff_rating), 1), 0.0),
        coalesce(round(avg(hygiene_rating), 1), 0.0),
        count(*)
    into v_avg_food_today, v_avg_staff_today, v_avg_hygiene_today, v_total_ratings_today
    from public.ratings
    where date = current_date;

    select coalesce(json_agg(c), '[]'::json)
    into v_oldest_complaints
    from (
        select id, tracking_id, category, description, status, created_at
        from public.complaints
        where status in ('pending', 'under_review')
        order by created_at asc
        limit 5
    ) c;

    return json_build_object(
        'headcount', json_build_object(
            'breakfast', v_breakfast_count,
            'lunch', v_lunch_count,
            'snacks', v_snacks_count,
            'dinner', v_dinner_count,
            'total', v_breakfast_count + v_lunch_count + v_snacks_count + v_dinner_count
        ),
        'pending_complaints', v_pending_complaints,
        'ratings_today', json_build_object(
            'food', v_avg_food_today,
            'staff', v_avg_staff_today,
            'hygiene', v_avg_hygiene_today,
            'count', v_total_ratings_today
        ),
        'oldest_pending_complaints', v_oldest_complaints
    );
end;
$$;
