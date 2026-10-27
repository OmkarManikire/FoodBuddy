-- 017_normalize_complaints_category_check.sql
-- Allow both snake_case and Title Case variants in complaints check constraint
-- and automatically normalize them to canonical Title Case inside create_complaint RPC.

ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_category_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_category_check CHECK (
    category IN (
        'Food Quality', 'Hygiene', 'Staff Behaviour', 'Staff Behavior', 'Infrastructure', 'Other',
        'food_quality', 'hygiene', 'staff_behavior', 'staff_behaviour', 'infrastructure', 'other'
    )
);

CREATE OR REPLACE FUNCTION public.create_complaint(
    p_category text,
    p_description text,
    p_media_paths text[] default array[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid;
    v_role text;
    v_hourly_count int;
    v_tracking_id text;
    v_complaint_id uuid;
    v_norm_category text;
BEGIN
    v_uid := auth.uid();
    if v_uid is null then
        return jsonb_build_object('success', false, 'error', 'Authentication required.');
    end if;

    if not public.is_verified_user() then
        return jsonb_build_object('success', false, 'error', 'OTP verification required.');
    end if;

    v_role := public.get_user_role();
    if v_role != 'student' then
        return jsonb_build_object('success', false, 'error', 'Only students can file dining complaints.');
    end if;

    -- Rate limit: max 5 complaints per hour per student
    select count(*) into v_hourly_count
    from public.complaints
    where student_id = v_uid
      and created_at > now() - interval '1 hour';

    if v_hourly_count >= 5 then
        return jsonb_build_object('success', false, 'error', 'Rate limit exceeded: You can submit at most 5 complaints per hour.');
    end if;

    -- Normalize category to standard title case matching check constraint
    case lower(replace(trim(coalesce(p_category, '')), '_', ' '))
        when 'food quality' then v_norm_category := 'Food Quality';
        when 'hygiene' then v_norm_category := 'Hygiene';
        when 'staff behavior' then v_norm_category := 'Staff Behaviour';
        when 'staff behaviour' then v_norm_category := 'Staff Behaviour';
        when 'infrastructure' then v_norm_category := 'Infrastructure';
        else v_norm_category := 'Other';
    end case;

    -- Generate tracking ID: FB-YYYY-XXXXX
    v_tracking_id := 'FB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.complaint_tracking_seq')::text, 5, '0');
    v_complaint_id := gen_random_uuid();

    insert into public.complaints (
        id, tracking_id, student_id, category, description, media_paths, status, created_at
    ) values (
        v_complaint_id, v_tracking_id, v_uid, v_norm_category, p_description, coalesce(p_media_paths, array[]::text[]), 'submitted', now()
    );

    insert into public.complaint_history (
        complaint_id, status, note, actor_role, changed_at
    ) values (
        v_complaint_id, 'submitted', 'Ticket registered by student', 'student', now()
    );

    return jsonb_build_object(
        'success', true,
        'complaint_id', v_complaint_id,
        'tracking_id', v_tracking_id
    );
END;
$$;
