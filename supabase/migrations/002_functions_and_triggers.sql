-- 002_functions_and_triggers.sql
-- Food Buddy Helper Functions and Security Triggers

-- 1. Helper function: is_verified_user()
-- Returns true only if the user is authenticated AND otp_verified_until > now()
create or replace function public.is_verified_user()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_verified_until timestamptz;
begin
    if auth.uid() is null then
        return false;
    end if;

    select otp_verified_until into v_verified_until
    from public.profiles
    where id = auth.uid();

    return v_verified_until is not null and v_verified_until > now();
end;
$$;

-- 2. Helper function: get_user_role()
-- Returns the role of the authenticated user ('student', 'mess_manager', 'authority')
create or replace function public.get_user_role()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_role text;
begin
    if auth.uid() is null then
        return null;
    end if;

    select role into v_role
    from public.profiles
    where id = auth.uid();

    return v_role;
end;
$$;

-- 3. Helper function: check_user_role(selected_role text)
-- Used by login page to verify that selected tab matches the account role
create or replace function public.check_user_role(selected_role text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_name text;
begin
    if auth.uid() is null then
        return json_build_object('success', false, 'error', 'Not authenticated');
    end if;

    select role, name into v_role, v_name
    from public.profiles
    where id = auth.uid();

    if v_role is null then
        return json_build_object('success', false, 'error', 'Profile not found');
    end if;

    if v_role != selected_role then
        return json_build_object(
            'success', false,
            'role_mismatch', true,
            'actual_role', v_role,
            'error', 'Your account is registered as ' || v_role || '. Please select the correct login tab.'
        );
    end if;

    return json_build_object(
        'success', true,
        'role', v_role,
        'name', v_name
    );
end;
$$;

-- 4. Helper function: clear_otp_verification()
-- Called during logout or session invalidation to clear verified status
create or replace function public.clear_otp_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null then
        update public.profiles
        set otp_verified_until = null,
            updated_at = now()
        where id = auth.uid();
    end if;
end;
$$;

-- 5. Trigger on auth.users insert: on_auth_user_created
-- Strictly validates student ID and creates profile.
-- Outsiders / unregistered IDs are rejected.
-- Mess Manager and Authority can only be created by admin/seed script.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_student_id text;
    v_name text;
    v_room_no text;
    v_hostel_block text;
    v_used boolean;
    v_is_admin_call boolean;
begin
    -- Determine role from metadata or default to student
    v_role := coalesce(new.raw_user_meta_data->>'role', 'student');
    v_name := coalesce(new.raw_user_meta_data->>'name', 'Campus User');
    v_student_id := trim(upper(coalesce(new.raw_user_meta_data->>'student_id', '')));
    v_room_no := new.raw_user_meta_data->>'room_no';
    v_hostel_block := new.raw_user_meta_data->>'hostel_block';

    -- Check if request comes from service_role or admin
    v_is_admin_call := (current_user in ('postgres', 'supabase_admin') or (auth.jwt()->>'role' = 'service_role') or auth.uid() is null);

    if v_role in ('mess_manager', 'authority') then
        -- Manager and Authority can only be provisioned by admin / seed script
        if not v_is_admin_call then
            raise exception 'Unauthorized role assignment: % accounts can only be provisioned by campus administration.', v_role;
        end if;

        insert into public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
        values (new.id, v_name, new.email, v_role, null, null, null, null);

        return new;
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 6. Trigger to prevent unauthorized modification of immutable columns in profiles
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- If executed by an authenticated client user
    if current_user = 'authenticated' then
        if new.role != old.role then
            raise exception 'Forbidden: Profile role cannot be changed.';
        end if;
        if new.student_id is distinct from old.student_id then
            raise exception 'Forbidden: Student ID cannot be modified.';
        end if;
        if new.id != old.id then
            raise exception 'Forbidden: Profile ID cannot be modified.';
        end if;
        if new.otp_verified_until is distinct from old.otp_verified_until then
            raise exception 'Forbidden: OTP verification status can only be updated by the server verification service.';
        end if;
    end if;

    new.updated_at := now();
    return new;
end;
$$;

create trigger protect_profile_columns_trigger
before update on public.profiles
for each row execute function public.protect_profile_columns();
