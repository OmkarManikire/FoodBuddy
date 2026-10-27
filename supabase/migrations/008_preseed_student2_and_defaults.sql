-- Migration 008: Default student_id & Preseed Student 2 (Rohan Sharma)

alter table public.ratings alter column student_id set default auth.uid();
alter table public.suggestions alter column student_id set default auth.uid();

insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) values (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student2@foodbuddy.test',
    crypt('Student2@Pass2025', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'student'),
    jsonb_build_object(
        'name', 'Rohan Sharma (Student)',
        'student_id', '2025CSB1002',
        'room_no', 'C-201',
        'hostel_block', 'Block C - Nilgiri Hostel',
        'role', 'student'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
) on conflict (id) do nothing;

update public.valid_student_ids set used = true, used_at = now() where student_id = '2025CSB1002';

insert into public.profiles (
    id, name, email, role, student_id, room_no, hostel_block, otp_verified_until
) values (
    'a0000000-0000-0000-0000-000000000002',
    'Rohan Sharma (Student)',
    'student2@foodbuddy.test',
    'student',
    '2025CSB1002',
    'C-201',
    'Block C - Nilgiri Hostel',
    now() + interval '12 hours'
) on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    student_id = excluded.student_id,
    otp_verified_until = now() + interval '12 hours';
