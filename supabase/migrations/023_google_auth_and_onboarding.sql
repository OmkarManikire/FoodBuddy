-- Migration 023: Google Auth Provider, Trigger Update, Account Linking & Onboarding Support
-- Enforces:
-- 1. Brand-new Google sign-ups never fail and start with NO role and NO access
-- 2. Profiles email case-insensitive uniqueness and account linking function
-- 3. Strict server-side profile role and verification guard

-- 1. Add unique index on LOWER(email) for profiles if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_lower_email ON public.profiles (LOWER(email));

-- 2. Secure Account Linking Helper Function
CREATE OR REPLACE FUNCTION public.link_profile_to_user(p_old_id UUID, p_new_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_old_id IS NULL OR p_new_id IS NULL OR p_old_id = p_new_id THEN
    RETURN;
  END IF;

  -- Re-point foreign keys
  UPDATE public.ratings SET student_id = p_new_id WHERE student_id = p_old_id;
  UPDATE public.attendance SET student_id = p_new_id WHERE student_id = p_old_id;
  UPDATE public.complaints SET student_id = p_new_id WHERE student_id = p_old_id;
  UPDATE public.suggestions SET student_id = p_new_id WHERE student_id = p_old_id;
  UPDATE public.notification_reads SET student_id = p_new_id WHERE student_id = p_old_id;
  UPDATE public.accountability_comments SET created_by = p_new_id WHERE created_by = p_old_id;
  UPDATE public.governance_actions SET created_by = p_new_id WHERE created_by = p_old_id;
  
  -- Update primary key in profiles
  UPDATE public.profiles SET id = p_new_id WHERE id = p_old_id;
END;
$$;

-- 3. Update handle_new_user() Trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_student_id text;
    v_name text;
    v_room_no text;
    v_hostel_block text;
    v_used boolean;
    v_admin_role text;
    v_user_req_role text;
    v_is_google boolean;
    v_existing_profile_id uuid;
BEGIN
    v_admin_role := NEW.raw_app_meta_data->>'role';
    v_user_req_role := NEW.raw_user_meta_data->>'role';
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    v_student_id := TRIM(UPPER(COALESCE(NEW.raw_user_meta_data->>'student_id', '')));
    v_room_no := NEW.raw_user_meta_data->>'room_no';
    v_hostel_block := NEW.raw_user_meta_data->>'hostel_block';

    -- Detect Google OAuth
    v_is_google := (
        COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'google' OR
        (NEW.raw_app_meta_data->'providers') ? 'google' OR
        COALESCE(NEW.raw_user_meta_data->>'iss', '') LIKE '%accounts.google.com%' OR
        COALESCE(NEW.raw_user_meta_data->>'iss', '') LIKE '%google%' OR
        NEW.raw_user_meta_data->>'is_google' = 'true'
    );

    -- 1. Google OAuth flow: Never fail and never create profile without valid role and Student ID
    IF v_is_google THEN
        SELECT id INTO v_existing_profile_id
        FROM public.profiles
        WHERE LOWER(email) = LOWER(NEW.email);

        IF v_existing_profile_id IS NOT NULL AND v_existing_profile_id <> NEW.id THEN
            PERFORM public.link_profile_to_user(v_existing_profile_id, NEW.id);
        END IF;

        -- Brand-new Google user starts with no role and no access
        RETURN NEW;
    END IF;

    -- 2. Staff / Administrative accounts provisioned via Admin API (service role)
    IF v_admin_role IN ('mess_manager', 'authority') THEN
        INSERT INTO public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
        VALUES (NEW.id, v_name, LOWER(NEW.email), v_admin_role, NULL, v_room_no, v_hostel_block, NULL)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role;
        RETURN NEW;
    END IF;

    -- 3. Block public clients claiming mess_manager or authority via user_metadata
    IF v_user_req_role IN ('mess_manager', 'authority') THEN
        RAISE EXCEPTION 'Unauthorized role assignment: % accounts can only be provisioned by campus administration.', v_user_req_role;
    END IF;

    -- 4. Mandatory Student ID for public email registration
    IF v_student_id = '' THEN
        RAISE EXCEPTION 'Registration failed: Student ID is required for student account creation.';
    END IF;

    -- 5. Atomically verify Student ID against valid_student_ids
    SELECT used INTO v_used
    FROM public.valid_student_ids
    WHERE student_id = v_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration failed: Student ID % is not recognized in institutional campus records.', v_student_id;
    END IF;

    IF v_used THEN
        RAISE EXCEPTION 'Registration failed: Student ID % has already been used to register an account.', v_student_id;
    END IF;

    -- Mark student ID as used
    UPDATE public.valid_student_ids
    SET used = true
    WHERE student_id = v_student_id;

    -- Insert student profile
    INSERT INTO public.profiles (id, name, email, role, student_id, room_no, hostel_block, otp_verified_until)
    VALUES (NEW.id, v_name, LOWER(NEW.email), 'student', v_student_id, v_room_no, v_hostel_block, NULL)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;
