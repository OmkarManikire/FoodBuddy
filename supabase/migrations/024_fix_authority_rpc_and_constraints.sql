-- ==========================================================
-- Migration 024: Fix Authority Schema & Constraints
-- 1. Ensure actor_role exists on complaint_history
-- 2. Align notices_priority_check with governance actions
-- 3. Robust demand_accountability and record_governance_action
-- ==========================================================

-- 1. Add actor_role to complaint_history if missing
ALTER TABLE public.complaint_history 
ADD COLUMN IF NOT EXISTS actor_role text not null default 'student';

-- 2. Normalize and expand notices priority check
UPDATE public.notices 
SET priority = 'special' 
WHERE priority NOT IN ('low', 'normal', 'urgent', 'critical', 'special', 'high', 'announcement');

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_priority_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_priority_check 
  CHECK (priority IN ('low', 'normal', 'urgent', 'critical', 'special', 'high', 'announcement'));

-- 3. Update record_governance_action RPC
CREATE OR REPLACE FUNCTION public.record_governance_action(
    p_month text,
    p_action text,
    p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_author_name text;
    v_id uuid;
BEGIN
    IF NOT (public.is_verified_user() AND public.get_user_role() = 'authority') THEN
        RAISE EXCEPTION 'Access denied: Higher Authority role required.' USING ERRCODE = '42501';
    END IF;

    IF p_action NOT IN ('renewal', 'penalty', 'warning', 'audit_demanded') THEN
        RAISE EXCEPTION 'Invalid governance action: %', p_action USING ERRCODE = '22023';
    END IF;

    IF p_note IS NULL OR trim(p_note) = '' THEN
        RAISE EXCEPTION 'Action justification note is required.' USING ERRCODE = '22023';
    END IF;

    v_user_id := auth.uid();
    SELECT name INTO v_author_name FROM public.profiles WHERE id = v_user_id;

    INSERT INTO public.governance_actions (month, action, note, created_by, created_at)
    VALUES (p_month, p_action, trim(p_note), v_user_id, now())
    RETURNING id INTO v_id;

    -- Also post official notice
    INSERT INTO public.notices (title, body, posted_by, author_name, priority, expires_at, is_archived, created_at)
    VALUES (
        'Institutional Caterer Governance Action [' || upper(p_action) || ']',
        'Administrative Order for Period ' || p_month || ': ' || trim(p_note),
        'authority',
        coalesce(v_author_name, 'Hostel Warden & Dean Office'),
        'urgent',
        now() + interval '30 days',
        false,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'action_id', v_id,
        'month', p_month,
        'action', p_action,
        'note', trim(p_note),
        'created_at', now()
    );
END;
$$;

-- 4. Update demand_accountability RPC
CREATE OR REPLACE FUNCTION public.demand_accountability(
    p_complaint_id uuid,
    p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_complaint record;
    v_comment_id uuid;
    v_user_id uuid;
    v_author_name text;
BEGIN
    IF NOT (public.is_verified_user() AND public.get_user_role() = 'authority') THEN
        RAISE EXCEPTION 'Access denied: Higher Authority role required.' USING ERRCODE = '42501';
    END IF;

    IF p_comment IS NULL OR trim(p_comment) = '' THEN
        RAISE EXCEPTION 'Accountability comment cannot be empty.' USING ERRCODE = '22023';
    END IF;

    v_user_id := auth.uid();
    SELECT name INTO v_author_name FROM public.profiles WHERE id = v_user_id;
    IF v_author_name IS NULL THEN
        v_author_name := 'Hostel Warden / Dean';
    END IF;

    SELECT * INTO v_complaint FROM public.complaints WHERE id = p_complaint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Ensure complaint is marked as escalated
    UPDATE public.complaints
    SET escalated = true,
        escalated_at = coalesce(escalated_at, now())
    WHERE id = p_complaint_id;

    -- Insert accountability comment
    INSERT INTO public.accountability_comments (complaint_id, comment, created_by, created_at)
    VALUES (p_complaint_id, trim(p_comment), v_user_id, now())
    RETURNING id INTO v_comment_id;

    -- Insert audit row into complaint_history
    INSERT INTO public.complaint_history (complaint_id, status, note, actor_role, changed_at)
    VALUES (
        p_complaint_id,
        'escalated',
        'Official Authority Directive: ' || trim(p_comment),
        'authority',
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'comment_id', v_comment_id,
        'id', v_comment_id,
        'complaint_id', p_complaint_id,
        'comment', trim(p_comment),
        'author', v_author_name,
        'created_at', now()
    );
END;
$$;

