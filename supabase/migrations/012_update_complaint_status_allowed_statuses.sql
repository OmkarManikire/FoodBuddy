-- Migration 012: Update update_complaint_status allowed statuses to match Stage 2 check constraint
CREATE OR REPLACE FUNCTION public.update_complaint_status(
    p_complaint_id uuid,
    p_status text,
    p_note text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
    v_user_id uuid;
    v_role text;
    v_complaint record;
begin
    v_user_id := auth.uid();
    if v_user_id is null or not public.is_verified_user() then
        raise exception 'Authentication and verification required.';
    end if;

    v_role := public.get_user_role();
    if v_role <> 'mess_manager' and v_role <> 'authority' then
        raise exception 'Access denied: Manager or Authority role required.';
    end if;

    if p_status not in ('submitted', 'under_review', 'in_progress', 'resolved', 'rejected') then
        raise exception 'Invalid complaint status: %', p_status;
    end if;

    if p_status = 'resolved' and (p_note is null or trim(p_note) = '') then
        raise exception 'A resolution note is required when resolving a complaint.';
    end if;

    update public.complaints
    set status = p_status,
        resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end,
        resolution_note = case when p_status = 'resolved' then p_note else resolution_note end
    where id = p_complaint_id
    returning * into v_complaint;

    if v_complaint.id is null then
        raise exception 'Complaint not found.';
    end if;

    insert into public.complaint_history (complaint_id, status, note, changed_at)
    values (
        p_complaint_id,
        p_status,
        coalesce(p_note, 'Status changed to ' || p_status || ' by Mess Manager'),
        now()
    );

    return json_build_object(
        'success', true,
        'id', v_complaint.id,
        'tracking_id', v_complaint.tracking_id,
        'status', v_complaint.status,
        'resolved_at', v_complaint.resolved_at,
        'resolution_note', v_complaint.resolution_note
    );
end;
$$;
