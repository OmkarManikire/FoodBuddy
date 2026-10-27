-- Migration 020: Seamless student registration and re-registration handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id text;
    v_name text;
    v_room_no text;
    v_hostel_block text;
    v_used boolean;
    v_admin_role text;
    v_user_req_role text;
BEGIN
    -- 1. Check raw_app_meta_data: this can ONLY be written by Admin API (service role)
    v_admin_role := new.raw_app_meta_data->>'role';
    v_user_req_role := new.raw_user_meta_data->>'role';
    v_name := coalesce(new.raw_user_meta_data->>'name', 'Campus User');
    v_student_id := trim(upper(coalesce(new.raw_user_meta_data->>'student_id', '')));
    v_room_no := new.raw_user_meta_data->>'room_no';
    v_hostel_block := new.raw_user_meta_data->>'hostel_block';

    -- If created via Admin API with role explicitly set in raw_app_meta_data
    if v_admin_role in ('mess_manager', 'authority') then
        insert into public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
        values (new.id, v_name, new.email, v_admin_role, null, null, null, null)
        on conflict (id) do update set
            name = excluded.name,
            email = excluded.email,
            role = excluded.role;
        return new;
    end if;

    -- If a public client attempts to register as manager or authority via user_metadata
    if v_user_req_role in ('mess_manager', 'authority') then
        raise exception 'Unauthorized role assignment: % accounts can only be provisioned by campus administration.', v_user_req_role;
    end if;

    -- For student registration, student ID is required
    if v_student_id = '' then
        raise exception 'Registration failed: Student ID is required for student account creation.';
    end if;

    -- Dynamically ensure student ID exists in valid_student_ids list
    insert into public.valid_student_ids (student_id, used, created_at)
    values (v_student_id, false, now())
    on conflict (student_id) do nothing;

    -- Atomically lock and verify student ID in campus records
    select used into v_used
    from public.valid_student_ids
    where student_id = v_student_id
    for update;

    -- Only reject if student ID is used AND assigned to another user
    if v_used and exists (
        select 1 from public.profiles
        where student_id = v_student_id and id <> new.id
    ) then
        raise exception 'Registration failed: Student ID % has already been used to register an account.', v_student_id;
    end if;

    -- Mark student ID as used
    update public.valid_student_ids
    set used = true,
        used_at = now()
    where student_id = v_student_id;

    -- Create or update student profile with role guaranteed as 'student'
    insert into public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
    values (new.id, v_name, new.email, 'student', v_student_id, v_room_no, v_hostel_block, null)
    on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        role = 'student',
        student_id = excluded.student_id,
        room_no = excluded.room_no,
        hostel_block = excluded.hostel_block;

    return new;
END;
$$;
