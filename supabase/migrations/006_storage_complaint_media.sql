-- Migration 006: Complaint Media Storage Bucket & RLS Policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'complaint-media',
    'complaint-media',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/webm', 'video/quicktime'];

create policy "student_upload_complaint_media"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'complaint-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_verified_user()
);

create policy "student_view_complaint_media"
on storage.objects for select
to authenticated
using (
    bucket_id = 'complaint-media'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.get_user_role() in ('mess_manager', 'authority')
    )
    and public.is_verified_user()
);
