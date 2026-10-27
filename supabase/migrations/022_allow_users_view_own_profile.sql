-- Migration 022: Allow authenticated users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id AND is_verified_user()
);
