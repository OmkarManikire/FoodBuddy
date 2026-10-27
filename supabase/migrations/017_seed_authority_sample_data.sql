-- Migration 017: Seed Complaints Older Than 48h and Initial Authority Data

DO $$
DECLARE
    v_student_id uuid;
    v_c1 uuid := 'c0000000-0000-0000-0000-000000000001';
    v_c2 uuid := 'c0000000-0000-0000-0000-000000000002';
    v_c3 uuid := 'c0000000-0000-0000-0000-000000000003';
    v_authority_id uuid;
BEGIN
    -- Find student ID
    SELECT id INTO v_student_id FROM public.profiles WHERE role = 'student' LIMIT 1;
    IF v_student_id IS NULL THEN
        v_student_id := 'a0000000-0000-0000-0000-000000000001';
    END IF;

    -- Find authority ID
    SELECT id INTO v_authority_id FROM public.profiles WHERE role = 'authority' LIMIT 1;
    IF v_authority_id IS NULL THEN
        v_authority_id := 'c0000000-0000-0000-0000-000000000003';
    END IF;

    -- 1. Insert overdue complaint 1 (68 hours overdue, Food Quality)
    IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE id = v_c1) THEN
        INSERT INTO public.complaints (
            id, tracking_id, student_id, category, description,
            media_paths, status, escalated, created_at
        ) VALUES (
            v_c1,
            'FB-2026-00091',
            v_student_id,
            'Food Quality',
            'Severe undercooked chicken curry served during dinner service. Multiple wing pieces had raw pink center with unpleasant odor. Kitchen staff refused on-spot exchange.',
            array['complaints/sample_food_raw.jpg'],
            'submitted',
            false,
            now() - interval '68 hours'
        );
    END IF;

    -- 2. Insert overdue complaint 2 (54 hours overdue, Hygiene)
    IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE id = v_c2) THEN
        INSERT INTO public.complaints (
            id, tracking_id, student_id, category, description,
            media_paths, status, escalated, created_at
        ) VALUES (
            v_c2,
            'FB-2026-00092',
            v_student_id,
            'Hygiene',
            'Foreign insect contaminant found embedded inside cooked dal bowl at counter 2. Photo submitted to mess attendant immediately but no corrective report was issued.',
            array['complaints/sample_hygiene_foreign.jpg'],
            'under_review',
            false,
            now() - interval '54 hours'
        );
    END IF;

    -- 3. Insert overdue complaint 3 (76 hours overdue, Infrastructure)
    IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE id = v_c3) THEN
        INSERT INTO public.complaints (
            id, tracking_id, student_id, category, description,
            media_paths, status, escalated, created_at
        ) VALUES (
            v_c3,
            'FB-2026-00093',
            v_student_id,
            'Infrastructure',
            'Main UV drinking water purification plant in Mess 1 dining hall leaking stagnant water and filter cartridge warning indicator flashing amber for past 3 days.',
            array['complaints/sample_water_filter.jpg'],
            'in_progress',
            false,
            now() - interval '76 hours'
        );
    END IF;

    -- 4. Seed initial official directive from Authority
    IF NOT EXISTS (SELECT 1 FROM public.notices WHERE title LIKE '%Mandatory Pest Control & Raw Material Audit%') THEN
        INSERT INTO public.notices (
            title, body, posted_by, author_name, priority, expires_at, is_archived, created_at
        ) VALUES (
            'Directive: Mandatory Pest Control & Raw Material Audit',
            'All catering contractor managers are directed to submit third-party pest control certification and supplier lot numbers for grain storage by Friday 17:00 IST. Failure will attract contractual penalty deductions.',
            'Authority',
            'Prof. R. Sengupta (Chief Hostel Warden)',
            'urgent',
            now() + interval '14 days',
            false,
            now() - interval '2 days'
        );
    END IF;

    -- 5. Seed initial governance action
    IF NOT EXISTS (SELECT 1 FROM public.governance_actions WHERE month = to_char(now(), 'YYYY-MM')) THEN
        INSERT INTO public.governance_actions (month, action, note, created_by, created_at)
        VALUES (
            to_char(now(), 'YYYY-MM'),
            'warning',
            'Formal Show-Cause Notice issued to Annapurna Caterers regarding breakfast timing delays and vegetable cleaning non-compliance.',
            v_authority_id,
            now() - interval '1 day'
        );
    END IF;

    -- 6. Execute process_complaint_escalations() manually to escalate overdue items
    PERFORM public.process_complaint_escalations();

END $$;
