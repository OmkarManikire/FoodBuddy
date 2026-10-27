-- Migration 004: Robust admin verification using raw_app_meta_data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id text;
    v_name text;
    v_room_no text;
    v_hostel_block text;
    v_used boolean;
    v_admin_role text;
    v_user_req_role text;
begin
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
        values (new.id, v_name, new.email, v_admin_role, null, null, null, null);
        return new;
    end if;

    -- If a public client attempts to register as manager or authority via user_metadata
    if v_user_req_role in ('mess_manager', 'authority') then
        raise exception 'Unauthorized role assignment: % accounts can only be provisioned by campus administration.', v_user_req_role;
    end if;

    -- For student registration, valid_student_ids verification is mandatory
    if v_student_id = '' then
        raise exception 'Registration failed: Student ID is required for student account creation.';
    end if;

    -- Atomically lock and verify student ID in pre-approved list
    select used into v_used
    from public.valid_student_ids
    where student_id = v_student_id
    for update;

    if not found then
        raise exception 'Registration failed: Student ID % is not recognized in institutional campus records.', v_student_id;
    end if;

    if v_used then
        raise exception 'Registration failed: Student ID % has already been used to register an account.', v_student_id;
    end if;

    -- Mark student ID as used
    update public.valid_student_ids
    set used = true,
        used_at = now()
    where student_id = v_student_id;

    -- Create student profile with role guaranteed as 'student'
    insert into public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
    values (new.id, v_name, new.email, 'student', v_student_id, v_room_no, v_hostel_block, null);

    return new;
end;
$$;
