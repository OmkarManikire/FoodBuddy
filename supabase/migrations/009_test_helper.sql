-- Migration 009: Test Reset Helper Function

create or replace function public.cleanup_test_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.complaints
    where description like 'Test stress complaint%'
       or description like 'Rice was slightly undercooked%';

    delete from public.attendance
    where student_id = 'a0000000-0000-0000-0000-000000000001'
      and date = current_date
      and meal_slot in ('lunch', 'dinner');

    delete from public.ratings
    where student_id = 'a0000000-0000-0000-0000-000000000001'
      and date = current_date
      and meal_slot = 'lunch';
end;
$$;
