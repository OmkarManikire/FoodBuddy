-- 018_add_profile_column_aliases.sql
-- Add generated alias columns to profiles table to support both naming conventions (room_number/room_no, hostel_name/hostel_block, roll_number/student_id)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS room_number text GENERATED ALWAYS AS (room_no) STORED;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hostel_name text GENERATED ALWAYS AS (hostel_block) STORED;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number text GENERATED ALWAYS AS (student_id) STORED;
