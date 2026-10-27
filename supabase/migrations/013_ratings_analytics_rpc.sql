-- Migration 013: Manager Ratings Analytics RPC
CREATE OR REPLACE FUNCTION public.get_manager_ratings_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
    v_user_id uuid;
    v_role text;
    v_overall_food numeric := 0.0;
    v_overall_staff numeric := 0.0;
    v_overall_hygiene numeric := 0.0;
    v_total_count int := 0;
    v_daily_trend json;
    v_stars json;
    v_comments json;
begin
    v_user_id := auth.uid();
    if v_user_id is null or not public.is_verified_user() then
        raise exception 'Authentication and verification required.';
    end if;

    v_role := public.get_user_role();
    if v_role <> 'mess_manager' and v_role <> 'authority' then
        raise exception 'Access denied: Manager or Authority role required.';
    end if;

    -- Overall 30-day averages
    select
        coalesce(round(avg(food_rating), 1), 0.0),
        coalesce(round(avg(staff_rating), 1), 0.0),
        coalesce(round(avg(hygiene_rating), 1), 0.0),
        count(*)
    into v_overall_food, v_overall_staff, v_overall_hygiene, v_total_count
    from public.ratings
    where date >= (current_date - interval '30 days');

    -- Daily trend past 7 days
    select coalesce(json_agg(t order by t.date asc), '[]'::json)
    into v_daily_trend
    from (
        select
            date,
            round(avg(food_rating), 1) as avg_food,
            round(avg(staff_rating), 1) as avg_staff,
            round(avg(hygiene_rating), 1) as avg_hygiene,
            count(*) as review_count
        from public.ratings
        where date >= (current_date - interval '6 days')
        group by date
    ) t;

    -- Star distribution (food_rating)
    select json_build_object(
        'star_5', count(*) filter (where food_rating = 5),
        'star_4', count(*) filter (where food_rating = 4),
        'star_3', count(*) filter (where food_rating = 3),
        'star_2', count(*) filter (where food_rating = 2),
        'star_1', count(*) filter (where food_rating = 1)
    )
    into v_stars
    from public.ratings
    where date >= (current_date - interval '30 days');

    -- Recent comments with student roll number
    select coalesce(json_agg(c), '[]'::json)
    into v_comments
    from (
        select
            r.id,
            r.date,
            r.meal_slot,
            r.food_rating,
            r.staff_rating,
            r.hygiene_rating,
            r.comment,
            r.created_at,
            coalesce(p.roll_number, 'Resident') as student_roll,
            coalesce(p.room_number, 'B-Block') as student_room
        from public.ratings r
        left join public.profiles p on p.id = r.student_id
        where r.comment is not null and trim(r.comment) <> ''
        order by r.created_at desc
        limit 20
    ) c;

    return json_build_object(
        'overall', json_build_object(
            'food', v_overall_food,
            'staff', v_overall_staff,
            'hygiene', v_overall_hygiene,
            'total_reviews', v_total_count
        ),
        'daily_trend', v_daily_trend,
        'star_distribution', v_stars,
        'recent_comments', v_comments
    );
end;
$$;
