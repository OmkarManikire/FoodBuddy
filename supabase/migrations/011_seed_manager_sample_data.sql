-- ==========================================================
-- Migration 011: Seed Manager Analytics & Operations Data
-- ==========================================================

do $$
declare
    v_student_id uuid;
    v_student2_id uuid;
    v_manager_id uuid;
    v_date date;
    v_c1_id uuid := gen_random_uuid();
    v_c2_id uuid := gen_random_uuid();
begin
    select id into v_student_id from public.profiles where email = 'student@foodbuddy.test' limit 1;
    select id into v_student2_id from public.profiles where email = 'student2@foodbuddy.test' limit 1;
    select id into v_manager_id from public.profiles where email = 'manager@foodbuddy.test' limit 1;

    update public.qr_sessions
    set expires_at = now() - interval '10 minutes'
    where token like 'FB-%';

    for i in 0..6 loop
        v_date := current_date - i;

        insert into public.attendance (student_id, meal_slot, date, scanned_at)
        values
            (v_student_id, 'breakfast', v_date, (v_date + time '08:15:00')::timestamptz),
            (v_student_id, 'lunch', v_date, (v_date + time '12:45:00')::timestamptz),
            (v_student_id, 'dinner', v_date, (v_date + time '20:10:00')::timestamptz)
        on conflict (student_id, meal_slot, date) do nothing;

        if v_student2_id is not null then
            insert into public.attendance (student_id, meal_slot, date, scanned_at)
            values
                (v_student2_id, 'lunch', v_date, (v_date + time '13:05:00')::timestamptz),
                (v_student2_id, 'snacks', v_date, (v_date + time '17:20:00')::timestamptz),
                (v_student2_id, 'dinner', v_date, (v_date + time '20:30:00')::timestamptz)
            on conflict (student_id, meal_slot, date) do nothing;
        end if;

        insert into public.ratings (student_id, date, meal_slot, food_rating, staff_rating, hygiene_rating, comment)
        values
            (v_student_id, v_date, 'lunch', 4, 5, 4, case when i = 0 then 'Paneer butter masala was warm and well spiced.' else 'Good food quality and clean dining tables.' end),
            (v_student_id, v_date, 'dinner', 3, 4, 4, 'Rotis were fresh, dal could have a bit less salt.')
        on conflict (student_id, date, meal_slot) do nothing;

        if v_student2_id is not null then
            insert into public.ratings (student_id, date, meal_slot, food_rating, staff_rating, hygiene_rating, comment)
            values
                (v_student2_id, v_date, 'lunch', 5, 4, 5, 'Excellent curd and jeera rice balance today.'),
                (v_student2_id, v_date, 'dinner', 4, 5, 4, 'Efficient staff queue management.')
            on conflict (student_id, date, meal_slot) do nothing;
        end if;

        insert into public.quality_checklists (date, meal_slot, items, signed_by, signed_at, head_cook_name, notes)
        values (
            v_date,
            'lunch',
            jsonb_build_array(
                jsonb_build_object('id', 'temp', 'title', 'Serving Temperature Checked (>65°C)', 'passed', true),
                jsonb_build_object('id', 'salt', 'title', 'Salt & Seasoning Taste Test Verified', 'passed', true),
                jsonb_build_object('id', 'hygiene', 'title', 'Cooks & Counter Staff Hairnets / Gloves Worn', 'passed', true),
                jsonb_build_object('id', 'roti', 'title', 'Rotis / Chapatis Soft & Fluffy (No Soggy Batches)', 'passed', true),
                jsonb_build_object('id', 'sample', 'title', 'Standard 200g Counter Sample Retained & Labeled', 'passed', true)
            ),
            v_manager_id,
            (v_date + time '11:45:00')::timestamptz,
            'Chef Rameshwar Kumar',
            'All parameters verified in batch 1.'
        )
        on conflict (date, meal_slot) do nothing;

        insert into public.quality_checklists (date, meal_slot, items, signed_by, signed_at, head_cook_name, notes)
        values (
            v_date,
            'dinner',
            jsonb_build_array(
                jsonb_build_object('id', 'temp', 'title', 'Serving Temperature Checked (>65°C)', 'passed', true),
                jsonb_build_object('id', 'salt', 'title', 'Salt & Seasoning Taste Test Verified', 'passed', true),
                jsonb_build_object('id', 'hygiene', 'title', 'Cooks & Counter Staff Hairnets / Gloves Worn', 'passed', true),
                jsonb_build_object('id', 'roti', 'title', 'Rotis / Chapatis Soft & Fluffy (No Soggy Batches)', 'passed', true),
                jsonb_build_object('id', 'sample', 'title', 'Standard 200g Counter Sample Retained & Labeled', 'passed', true)
            ),
            v_manager_id,
            (v_date + time '19:15:00')::timestamptz,
            'Chef Suresh Verma',
            'Evening service inspection passed.'
        )
        on conflict (date, meal_slot) do nothing;
    end loop;

    if v_student_id is not null then
        insert into public.complaints (id, tracking_id, student_id, category, description, media_paths, status, created_at)
        values (
            v_c1_id,
            'FB-2026-00010',
            v_student_id,
            'Hygiene',
            'Drinking water water cooler near Counter 2 has slow drainage and water puddling.',
            '{}'::text[],
            'submitted',
            now() - interval '3 hours'
        ) on conflict do nothing;

        insert into public.complaint_history (complaint_id, status, note, changed_at)
        values (v_c1_id, 'submitted', 'Submitted by student resident', now() - interval '3 hours')
        on conflict do nothing;

        insert into public.complaints (id, tracking_id, student_id, category, description, media_paths, status, created_at)
        values (
            v_c2_id,
            'FB-2026-00011',
            v_student_id,
            'Food Quality',
            'Sambhar was lukewarm during Sunday breakfast rush.',
            '{}'::text[],
            'under_review',
            now() - interval '1 day'
        ) on conflict do nothing;

        insert into public.complaint_history (complaint_id, status, note, changed_at)
        values
            (v_c2_id, 'submitted', 'Submitted by student resident', now() - interval '1 day'),
            (v_c2_id, 'under_review', 'Assigned to Shift Supervisor for inspection', now() - interval '18 hours')
        on conflict do nothing;
    end if;

end $$;
