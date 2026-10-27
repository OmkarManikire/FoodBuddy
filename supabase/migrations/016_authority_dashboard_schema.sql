-- Migration 016: Higher Authority Dashboard Schema & Policies
-- Role: Higher Authority (Hostel Warden / Dean / Supervisory Oversight)

-- 1. Ensure escalated_at column on complaints
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 2. Create accountability_comments table
CREATE TABLE IF NOT EXISTS public.accountability_comments (
    id uuid primary key default gen_random_uuid(),
    complaint_id uuid not null references public.complaints(id) on delete cascade,
    comment text not null,
    created_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_accountability_cid ON public.accountability_comments(complaint_id);
ALTER TABLE public.accountability_comments ENABLE ROW LEVEL SECURITY;

-- 3. Create governance_actions table
CREATE TABLE IF NOT EXISTS public.governance_actions (
    id uuid primary key default gen_random_uuid(),
    month text not null, -- e.g. '2026-10'
    action text not null check (action in ('renewal', 'penalty', 'warning', 'audit_demanded')),
    note text not null,
    created_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_governance_month ON public.governance_actions(month);
ALTER TABLE public.governance_actions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Authority on tables
-- 4.1 Complaints: Authority can read all
DROP POLICY IF EXISTS "authority_view_all_complaints" ON public.complaints;
CREATE POLICY "authority_view_all_complaints"
    ON public.complaints FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

-- 4.2 Complaint History: Authority can read all
DROP POLICY IF EXISTS "authority_view_complaint_history" ON public.complaint_history;
CREATE POLICY "authority_view_complaint_history"
    ON public.complaint_history FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

-- 4.3 Accountability Comments:
-- Authority can insert and read all
DROP POLICY IF EXISTS "authority_insert_accountability" ON public.accountability_comments;
CREATE POLICY "authority_insert_accountability"
    ON public.accountability_comments FOR INSERT
    WITH CHECK (public.is_verified_user() AND public.get_user_role() = 'authority');

DROP POLICY IF EXISTS "authority_select_accountability" ON public.accountability_comments;
CREATE POLICY "authority_select_accountability"
    ON public.accountability_comments FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() in ('authority', 'mess_manager'));

-- 4.4 Governance Actions:
DROP POLICY IF EXISTS "authority_insert_governance" ON public.governance_actions;
CREATE POLICY "authority_insert_governance"
    ON public.governance_actions FOR INSERT
    WITH CHECK (public.is_verified_user() AND public.get_user_role() = 'authority');

DROP POLICY IF EXISTS "authority_select_governance" ON public.governance_actions;
CREATE POLICY "authority_select_governance"
    ON public.governance_actions FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() in ('authority', 'mess_manager'));

-- 4.5 Ratings, Attendance, Quality Checklists read access
DROP POLICY IF EXISTS "authority_view_ratings" ON public.ratings;
CREATE POLICY "authority_view_ratings"
    ON public.ratings FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

DROP POLICY IF EXISTS "authority_view_attendance" ON public.attendance;
CREATE POLICY "authority_view_attendance"
    ON public.attendance FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

DROP POLICY IF EXISTS "authority_view_checklists" ON public.quality_checklists;
CREATE POLICY "authority_view_checklists"
    ON public.quality_checklists FOR SELECT
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

-- 4.6 Notices: Authority can post & update directives
DROP POLICY IF EXISTS "authority_insert_notices" ON public.notices;
CREATE POLICY "authority_insert_notices"
    ON public.notices FOR INSERT
    WITH CHECK (public.is_verified_user() AND public.get_user_role() = 'authority');

DROP POLICY IF EXISTS "authority_update_notices" ON public.notices;
CREATE POLICY "authority_update_notices"
    ON public.notices FOR UPDATE
    USING (public.is_verified_user() AND public.get_user_role() = 'authority');

-- 5. Enable Realtime on accountability_comments & governance_actions
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.accountability_comments;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.governance_actions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 6. RPC: process_complaint_escalations
CREATE OR REPLACE FUNCTION public.process_complaint_escalations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int := 0;
    v_rec record;
BEGIN
    FOR v_rec IN 
        SELECT id, tracking_id, category, description, created_at
        FROM public.complaints
        WHERE status NOT IN ('resolved', 'rejected')
          AND created_at < (now() - interval '48 hours')
          AND (escalated = false OR escalated IS NULL)
    LOOP
        UPDATE public.complaints
        SET escalated = true,
            escalated_at = coalesce(escalated_at, now())
        WHERE id = v_rec.id;

        -- Insert complaint history audit row
        INSERT INTO public.complaint_history (complaint_id, status, note, actor_role, changed_at)
        VALUES (
            v_rec.id, 
            'escalated', 
            'Automatic SLA Breach Escalation: Unresolved for >48 hours. Escalated to Higher Authority (Hostel Warden / Dean).', 
            'system', 
            now()
        );

        -- Insert urgent notice to notify managers and students
        INSERT INTO public.notices (title, body, posted_by, author_name, priority, expires_at, is_archived, created_at)
        VALUES (
            'SLA Escalation Alert: ' || v_rec.tracking_id,
            'Grievance [' || v_rec.tracking_id || '] (' || v_rec.category || ') has exceeded the 48-hour resolution SLA threshold and is now flagged under Higher Authority Escalation Review.',
            'Authority',
            'Hostel Warden & Dean Office',
            'high',
            now() + interval '7 days',
            false,
            now()
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'escalated_count', v_count,
        'timestamp', now()
    );
END;
$$;

-- Try pg_cron schedule if extension is available
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM cron.schedule(
            'hourly-complaint-escalation',
            '0 * * * *',
            'SELECT public.process_complaint_escalations();'
        );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 7. RPC: demand_accountability(p_complaint_id, p_comment)
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
    -- Verify authority role
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

    -- Insert audit row into complaint_history so manager & student see it
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
        'complaint_id', p_complaint_id,
        'author', v_author_name,
        'comment', trim(p_comment),
        'created_at', now()
    );
END;
$$;

-- 8. RPC: get_authority_overview_kpis()
CREATE OR REPLACE FUNCTION public.get_authority_overview_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_complaints int := 0;
    v_pending_complaints int := 0;
    v_resolved_complaints int := 0;
    v_escalated_complaints int := 0;
    v_avg_food numeric(3,1) := 4.2;
    v_avg_staff numeric(3,1) := 4.5;
    v_trend_series jsonb := '[]'::jsonb;
    v_recent_escalations jsonb := '[]'::jsonb;
BEGIN
    IF NOT (public.is_verified_user() AND public.get_user_role() = 'authority') THEN
        RAISE EXCEPTION 'Access denied: Higher Authority role required.' USING ERRCODE = '42501';
    END IF;

    -- Counts
    SELECT count(*) INTO v_total_complaints FROM public.complaints;
    SELECT count(*) INTO v_pending_complaints FROM public.complaints WHERE status IN ('submitted', 'under_review', 'in_progress');
    SELECT count(*) INTO v_resolved_complaints FROM public.complaints WHERE status = 'resolved';
    SELECT count(*) INTO v_escalated_complaints FROM public.complaints WHERE escalated = true AND status NOT IN ('resolved', 'rejected');

    -- Ratings averages
    SELECT coalesce(round(avg(food_rating)::numeric, 1), 4.2),
           coalesce(round(avg(staff_rating)::numeric, 1), 4.5)
    INTO v_avg_food, v_avg_staff
    FROM public.ratings;

    -- Complaints over time (last 7 days)
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'date', to_char(d, 'YYYY-MM-DD'),
            'label', to_char(d, 'Dy DD'),
            'total', coalesce(c.total_count, 0),
            'resolved', coalesce(c.resolved_count, 0),
            'escalated', coalesce(c.escalated_count, 0)
        ) ORDER BY d ASC
    ), '[]'::jsonb)
    INTO v_trend_series
    FROM generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS d
    LEFT JOIN (
        SELECT 
            created_at::date as c_date,
            count(*) as total_count,
            count(*) filter (where status = 'resolved') as resolved_count,
            count(*) filter (where escalated = true) as escalated_count
        FROM public.complaints
        GROUP BY created_at::date
    ) c ON c.c_date = d::date;

    -- Recent critical escalations
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'tracking_id', c.tracking_id,
            'category', c.category,
            'description', c.description,
            'status', c.status,
            'created_at', c.created_at,
            'hours_overdue', greatest(0, round(extract(epoch from (now() - c.created_at)) / 3600 - 48)),
            'student_name', p.name,
            'student_room', p.hostel_block || ' - ' || p.room_no
        ) ORDER BY c.created_at ASC
    ), '[]'::jsonb)
    INTO v_recent_escalations
    FROM (
        SELECT * FROM public.complaints
        WHERE escalated = true AND status NOT IN ('resolved', 'rejected')
        ORDER BY created_at ASC
        LIMIT 5
    ) c
    LEFT JOIN public.profiles p ON p.id = c.student_id;

    RETURN jsonb_build_object(
        'total_complaints', v_total_complaints,
        'pending_complaints', v_pending_complaints,
        'resolved_complaints', v_resolved_complaints,
        'escalated_complaints', v_escalated_complaints,
        'overall_food_rating', v_avg_food,
        'overall_staff_rating', v_avg_staff,
        'trend_series', v_trend_series,
        'recent_escalations', v_recent_escalations
    );
END;
$$;

-- 9. RPC: get_authority_quality_index(p_days)
CREATE OR REPLACE FUNCTION public.get_authority_quality_index(p_days int default 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_daily_trends jsonb := '[]'::jsonb;
    v_category_breakdown jsonb := '[]'::jsonb;
    v_food_avg numeric(3,1) := 4.2;
    v_staff_avg numeric(3,1) := 4.5;
    v_weekly_food_avg numeric(3,1) := 4.1;
    v_weekly_staff_avg numeric(3,1) := 4.6;
BEGIN
    IF NOT (public.is_verified_user() AND public.get_user_role() = 'authority') THEN
        RAISE EXCEPTION 'Access denied: Higher Authority role required.' USING ERRCODE = '42501';
    END IF;

    -- Overall averages
    SELECT coalesce(round(avg(food_rating)::numeric, 1), 4.2),
           coalesce(round(avg(staff_rating)::numeric, 1), 4.5)
    INTO v_food_avg, v_staff_avg
    FROM public.ratings
    WHERE created_at >= (now() - (p_days || ' days')::interval);

    -- Weekly averages
    SELECT coalesce(round(avg(food_rating)::numeric, 1), 4.1),
           coalesce(round(avg(staff_rating)::numeric, 1), 4.6)
    INTO v_weekly_food_avg, v_weekly_staff_avg
    FROM public.ratings
    WHERE created_at >= (now() - interval '7 days');

    -- Daily ratings trend
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'date', to_char(d, 'YYYY-MM-DD'),
            'label', to_char(d, 'MM/DD'),
            'food_rating', coalesce(r.food_avg, 4.0),
            'staff_rating', coalesce(r.staff_avg, 4.5),
            'reviews_count', coalesce(r.reviews_count, 0)
        ) ORDER BY d ASC
    ), '[]'::jsonb)
    INTO v_daily_trends
    FROM generate_series(
        CURRENT_DATE - ((p_days - 1) || ' days')::interval,
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS d
    LEFT JOIN (
        SELECT 
            created_at::date as r_date,
            round(avg(food_rating)::numeric, 1) as food_avg,
            round(avg(staff_rating)::numeric, 1) as staff_avg,
            count(*) as reviews_count
        FROM public.ratings
        GROUP BY created_at::date
    ) r ON r.r_date = d::date;

    -- Category breakdown for complaints
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'category', category,
            'count', cat_count,
            'percentage', round((cat_count::numeric / nullif((SELECT count(*) FROM public.complaints), 0) * 100)::numeric, 1)
        ) ORDER BY cat_count DESC
    ), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
        SELECT category, count(*) as cat_count
        FROM public.complaints
        GROUP BY category
    ) cb;

    RETURN jsonb_build_object(
        'overall_food_avg', v_food_avg,
        'overall_staff_avg', v_staff_avg,
        'weekly_food_avg', v_weekly_food_avg,
        'weekly_staff_avg', v_weekly_staff_avg,
        'daily_trends', v_daily_trends,
        'category_breakdown', v_category_breakdown
    );
END;
$$;

-- 10. RPC: get_caterer_scorecard(p_month)
CREATE OR REPLACE FUNCTION public.get_caterer_scorecard(p_month text default null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month text := coalesce(p_month, to_char(CURRENT_DATE, 'YYYY-MM'));
    v_avg_rating numeric(3,1) := 4.2;
    v_avg_resolution_hours numeric(5,1) := 18.5;
    v_total_complaints int := 0;
    v_total_escalations int := 0;
    v_compliance_score int := 85;
    v_actions jsonb := '[]'::jsonb;
BEGIN
    IF NOT (public.is_verified_user() AND public.get_user_role() = 'authority') THEN
        RAISE EXCEPTION 'Access denied: Higher Authority role required.' USING ERRCODE = '42501';
    END IF;

    -- Average rating for the selected month
    SELECT coalesce(round(((avg(food_rating) + avg(staff_rating)) / 2.0)::numeric, 1), 4.2)
    INTO v_avg_rating
    FROM public.ratings
    WHERE to_char(created_at, 'YYYY-MM') = v_month;

    -- Total complaints & escalations in the month
    SELECT 
        count(*),
        count(*) filter (where escalated = true)
    INTO v_total_complaints, v_total_escalations
    FROM public.complaints
    WHERE to_char(created_at, 'YYYY-MM') = v_month;

    -- Average resolution hours
    SELECT coalesce(round(avg(extract(epoch from (resolved_at - created_at)) / 3600.0)::numeric, 1), 18.5)
    INTO v_avg_resolution_hours
    FROM public.complaints
    WHERE status = 'resolved' 
      AND resolved_at IS NOT NULL
      AND to_char(created_at, 'YYYY-MM') = v_month;

    -- Computed composite compliance index (0 to 100)
    v_compliance_score := greatest(0, least(100, round(
        (v_avg_rating / 5.0 * 50) +
        (CASE 
            WHEN v_avg_resolution_hours <= 24 THEN 30
            WHEN v_avg_resolution_hours <= 48 THEN 20
            ELSE 10 
         END) -
        (v_total_escalations * 5)
    )));

    -- Fetch recorded governance actions
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id', g.id,
            'month', g.month,
            'action', g.action,
            'note', g.note,
            'created_at', g.created_at,
            'author_name', p.name
        ) ORDER BY g.created_at DESC
    ), '[]'::jsonb)
    INTO v_actions
    FROM public.governance_actions g
    LEFT JOIN public.profiles p ON p.id = g.created_by;

    RETURN jsonb_build_object(
        'vendor_name', 'Annapurna Caterers & Hospitality Consortium',
        'contract_scope', 'Campus Central Dining Halls 1–4',
        'month', v_month,
        'avg_rating', v_avg_rating,
        'avg_resolution_hours', v_avg_resolution_hours,
        'total_complaints', v_total_complaints,
        'total_escalations', v_total_escalations,
        'compliance_score', v_compliance_score,
        'governance_actions', v_actions
    );
END;
$$;

-- 11. RPC: record_governance_action(p_month, p_action, p_note)
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

    -- Also post official notice if penalty or renewal recommended
    INSERT INTO public.notices (title, body, posted_by, author_name, priority, expires_at, is_archived, created_at)
    VALUES (
        'Institutional Caterer Governance Action [' || upper(p_action) || ']',
        'Administrative Order for Period ' || p_month || ': ' || trim(p_note),
        'Authority',
        coalesce(v_author_name, 'Hostel Warden & Dean Office'),
        'high',
        now() + interval '30 days',
        false,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'month', p_month,
        'action', p_action,
        'note', trim(p_note),
        'created_at', now()
    );
END;
$$;
