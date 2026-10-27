-- Migration 015: Allow Mess Manager and Authority to select all notices (including archived ones)
DROP POLICY IF EXISTS "notices_manager_select" ON public.notices;

CREATE POLICY "notices_manager_select"
ON public.notices FOR SELECT
USING (
    public.is_verified_user() 
    AND public.get_user_role() IN ('mess_manager', 'authority')
);
