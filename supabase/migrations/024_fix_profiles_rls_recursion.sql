-- Migration 024: Fix infinite recursion in Profiles RLS policy using get_verified_role()
DROP POLICY IF EXISTS "Profiles readable only by OTP-verified users" ON public.profiles;

CREATE POLICY "Profiles readable only by OTP-verified users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_verified_user() AND (
    id = auth.uid() OR
    get_verified_role() IN ('mess_manager', 'authority')
  )
);
