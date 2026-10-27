-- Migration 025: Update protect_profile_fields to allow client clear_otp_verification() to NULL on logout
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user != 'service_role' AND auth.role() != 'service_role' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: Changing profile role is strictly prohibited.';
    END IF;

    -- Clients can only revoke/clear verification (set to NULL) on logout.
    -- Granting or extending verification is strictly reserved for service role.
    IF NEW.otp_verified_until IS DISTINCT FROM OLD.otp_verified_until THEN
      IF NEW.otp_verified_until IS NOT NULL THEN
        RAISE EXCEPTION 'Access Denied: otp_verified_until is managed exclusively by the authentication service.';
      END IF;
    END IF;

    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Access Denied: Student ID cannot be modified once enrolled.';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
