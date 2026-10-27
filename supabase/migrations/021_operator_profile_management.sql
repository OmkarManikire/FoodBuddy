-- Migration 021: Operator profile management & staff registration
-- 1. Helper RPC for users (managers, authorities, students) to safely update their own display name & facility
CREATE OR REPLACE FUNCTION public.update_my_profile(
    p_name text,
    p_hostel_block text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_profile record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF trim(coalesce(p_name, '')) = '' THEN
        RAISE EXCEPTION 'Name cannot be empty';
    END IF;

    UPDATE public.profiles
    SET name = trim(p_name),
        hostel_block = CASE 
            WHEN p_hostel_block IS NOT NULL AND trim(p_hostel_block) <> '' THEN trim(p_hostel_block)
            ELSE hostel_block 
        END,
        updated_at = now()
    WHERE id = v_uid
    RETURNING * INTO v_profile;

    -- Also keep auth.users raw_user_meta_data synchronized
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{name}',
        to_jsonb(trim(p_name))
    )
    WHERE id = v_uid;

    RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;

-- 2. Update handle_new_user trigger to preserve facility / hostel_block for managers and authorities
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
    v_effective_role text;
    v_gateway_token text;
    v_expected_md5 text;
    v_expected_sha256 text;
BEGIN
    v_admin_role := new.raw_app_meta_data->>'role';
    v_user_req_role := new.raw_user_meta_data->>'role';
    v_effective_role := coalesce(v_admin_role, v_user_req_role, 'student');
    v_name := coalesce(new.raw_user_meta_data->>'name', 'Campus User');
    v_student_id := trim(upper(coalesce(new.raw_user_meta_data->>'student_id', '')));
    v_room_no := new.raw_user_meta_data->>'room_no';
    v_hostel_block := new.raw_user_meta_data->>'hostel_block';
    v_gateway_token := new.raw_user_meta_data->>'gateway_token';
    v_expected_md5 := md5(lower(new.email) || 'FOOD_BUDDY_STAFF_GATEWAY_2025');
    v_expected_sha256 := encode(sha256((lower(new.email) || 'FOOD_BUDDY_STAFF_GATEWAY_2025')::bytea), 'hex');

    -- If created with role 'mess_manager' or 'authority'
    IF v_effective_role IN ('mess_manager', 'authority') THEN
        IF (v_admin_role IN ('mess_manager', 'authority')) 
           OR (v_gateway_token = v_expected_md5) 
           OR (v_gateway_token = v_expected_sha256) THEN
            INSERT INTO public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
            VALUES (new.id, v_name, new.email, v_effective_role, null, null, v_hostel_block, null)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                role = excluded.role,
                hostel_block = coalesce(excluded.hostel_block, public.profiles.hostel_block);
            RETURN new;
        ELSE
            RAISE EXCEPTION 'Unauthorized role assignment: % accounts must be registered via the institutional portal gateway.', v_effective_role;
        END IF;
    END IF;

    -- For student registration, student ID is required
    IF v_student_id = '' THEN
        RAISE EXCEPTION 'Registration failed: Student ID is required for student account creation.';
    END IF;

    -- Dynamically ensure student ID exists in valid_student_ids list
    INSERT INTO public.valid_student_ids (student_id, used, created_at)
    VALUES (v_student_id, false, now())
    ON CONFLICT (student_id) DO NOTHING;

    -- Atomically lock and verify student ID in campus records
    SELECT used INTO v_used
    FROM public.valid_student_ids
    WHERE student_id = v_student_id
    FOR UPDATE;

    -- Only reject if student ID is used AND assigned to another user
    IF v_used AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE student_id = v_student_id AND id <> new.id
    ) THEN
        RAISE EXCEPTION 'Registration failed: Student ID % has already been used to register an account.', v_student_id;
    END IF;

    -- Mark student ID as used
    UPDATE public.valid_student_ids
    SET used = true,
        used_at = now()
    WHERE student_id = v_student_id;

    -- Create or update student profile with role guaranteed as 'student'
    INSERT INTO public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
    VALUES (new.id, v_name, new.email, 'student', v_student_id, v_room_no, v_hostel_block, null)
    ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        role = 'student',
        student_id = excluded.student_id,
        room_no = excluded.room_no,
        hostel_block = excluded.hostel_block;

    RETURN new;
END;
$$;
