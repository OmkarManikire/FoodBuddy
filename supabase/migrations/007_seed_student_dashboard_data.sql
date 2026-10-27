-- Migration 007: Seed Student Dashboard Data (Menus, Notices, QR Sessions, Complaints)

-- 1. SEED 7 DAYS OF MENUS (current_date to current_date + 6)
insert into public.menu (date, meal_slot, title, timing, special, calories, items)
values
  -- TODAY (Breakfast, Lunch, Snacks, Dinner)
  (current_date, 'breakfast', 'South Indian Breakfast Feast', '07:30 AM – 09:30 AM', false, 420,
   '[{"name": "Steamed Idli (3 pcs)", "type": "veg", "calories": 160, "allergens": []},
     {"name": "Crispy Medu Vada (1 pc)", "type": "veg", "calories": 140, "allergens": []},
     {"name": "Piping Hot Sambar", "type": "veg", "calories": 80, "allergens": []},
     {"name": "Coconut & Tomato Chutneys", "type": "veg", "calories": 40, "allergens": ["Coconut"]},
     {"name": "Tea / Coffee / Warm Milk", "type": "veg", "calories": 60, "allergens": ["Dairy"]}]'::jsonb),

  (current_date, 'lunch', 'North Indian Royal Thali', '12:30 PM – 02:30 PM', true, 680,
   '[{"name": "Shahi Paneer (Veg) / Butter Chicken (Non-Veg)", "type": "special", "calories": 240, "allergens": ["Dairy"]},
     {"name": "Dal Makhani (Slow Cooked)", "type": "veg", "calories": 180, "allergens": ["Dairy"]},
     {"name": "Jeera Basmati Rice", "type": "veg", "calories": 150, "allergens": []},
     {"name": "Fresh Butter Phulkas (3 pcs)", "type": "veg", "calories": 180, "allergens": ["Gluten"]},
     {"name": "Boondi Raita & Cucumber Salad", "type": "veg", "calories": 70, "allergens": ["Dairy"]},
     {"name": "Hot Gulab Jamun (1 pc)", "type": "veg", "calories": 140, "allergens": ["Dairy", "Gluten"]}]'::jsonb),

  (current_date, 'snacks', 'Evening Refreshment', '05:00 PM – 06:15 PM', false, 280,
   '[{"name": "Crispy Vegetable Samosa (1 pc)", "type": "veg", "calories": 180, "allergens": ["Gluten"]},
     {"name": "Tangy Tamarind & Mint Chutneys", "type": "veg", "calories": 30, "allergens": []},
     {"name": "Masala Ginger Chai / Lemon Tea", "type": "veg", "calories": 70, "allergens": ["Dairy"]}]'::jsonb),

  (current_date, 'dinner', 'Comfort Dinner Buffet', '07:45 PM – 09:45 PM', false, 550,
   '[{"name": "Mixed Vegetable Kadai", "type": "veg", "calories": 160, "allergens": []},
     {"name": "Yellow Dal Tadka", "type": "veg", "calories": 130, "allergens": []},
     {"name": "Steamed Sona Masoori Rice", "type": "veg", "calories": 150, "allergens": []},
     {"name": "Tawa Roti with Desi Ghee", "type": "veg", "calories": 140, "allergens": ["Gluten"]},
     {"name": "Kachumber Salad & Roasted Papad", "type": "veg", "calories": 40, "allergens": []},
     {"name": "Chilled Kheer", "type": "veg", "calories": 120, "allergens": ["Dairy"]}]'::jsonb),

  -- TOMORROW (Breakfast, Lunch, Snacks, Dinner)
  (current_date + interval '1 day', 'breakfast', 'High-Protein Breakfast', '07:30 AM – 09:30 AM', false, 440,
   '[{"name": "Aloo Poha with Roasted Peanuts", "type": "veg", "calories": 210, "allergens": ["Nuts"]},
     {"name": "Boiled Eggs (2 pcs) / Sprouts Salad", "type": "special", "calories": 140, "allergens": ["Egg"]},
     {"name": "Toasted Multigrain Bread with Jam", "type": "veg", "calories": 120, "allergens": ["Gluten"]},
     {"name": "Tea / Coffee / Bournvita", "type": "veg", "calories": 60, "allergens": ["Dairy"]}]'::jsonb),

  (current_date + interval '1 day', 'lunch', 'Homestyle Thali', '12:30 PM – 02:30 PM', false, 620,
   '[{"name": "Chole Masala (Amritsari Style)", "type": "veg", "calories": 220, "allergens": []},
     {"name": "Fluffy Bhature / Steamed Rice", "type": "veg", "calories": 260, "allergens": ["Gluten"]},
     {"name": "Aloo Palak Sabzi", "type": "veg", "calories": 130, "allergens": []},
     {"name": "Pickled Onions & Roasted Papad", "type": "veg", "calories": 40, "allergens": []}]'::jsonb),

  (current_date + interval '1 day', 'snacks', 'Chai & Snacks', '05:00 PM – 06:15 PM', false, 250,
   '[{"name": "Veg Puff (Crispy Layered Pastry)", "type": "veg", "calories": 190, "allergens": ["Gluten"]},
     {"name": "Cardamom Chai & Biscuits", "type": "veg", "calories": 60, "allergens": ["Dairy"]}]'::jsonb),

  (current_date + interval '1 day', 'dinner', 'Light Healthy Dinner', '07:45 PM – 09:45 PM', false, 510,
   '[{"name": "Paneer Bhurji / Egg Bhurji", "type": "special", "calories": 180, "allergens": ["Dairy", "Egg"]},
     {"name": "Moong Dal Khichdi & Curd", "type": "veg", "calories": 210, "allergens": ["Dairy"]},
     {"name": "Garlic Roti (2 pcs)", "type": "veg", "calories": 140, "allergens": ["Gluten"]}]'::jsonb)
on conflict (date, meal_slot) do update set
  title = excluded.title,
  timing = excluded.timing,
  items = excluded.items,
  special = excluded.special,
  calories = excluded.calories;

-- 2. SEED ACTIVE QR SESSIONS FOR TESTING
insert into public.qr_sessions (token, meal_slot, date, expires_at)
values
  ('FB-LUNCH-2025', 'lunch', current_date, now() + interval '10 years'),
  ('FB-DINNER-2025', 'dinner', current_date, now() + interval '10 years'),
  ('FB-BREAKFAST-2025', 'breakfast', current_date, now() + interval '10 years'),
  ('FB-EXPIRED-TEST', 'lunch', current_date - interval '1 day', now() - interval '2 hours')
on conflict (token) do update set
  expires_at = excluded.expires_at,
  meal_slot = excluded.meal_slot,
  date = excluded.date;

-- 3. SEED NOTICES
insert into public.notices (id, title, body, posted_by, author_name, priority, expires_at, is_archived, created_at)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    'Water Cooler Maintenance in Block B Tonight',
    'Routine maintenance and reverse-osmosis UV filter replacement for the water dispensers on Floor 2 and Floor 3 will take place between 10:00 PM and 11:30 PM. Alternative drinking water dispensers on Floor 1 will remain fully operational.',
    'mess_manager',
    'Rajesh Verma (Mess Manager)',
    'normal',
    now() + interval '7 days',
    false,
    now() - interval '3 hours'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'Monthly Mess Committee Review Meeting',
    'The monthly hygiene and mess quality review will be convened this Friday at 4:30 PM in Conference Hall A. Student representatives from all hostel blocks are requested to attend with consolidated floor feedback.',
    'authority',
    'Dr. Meenakshi Sundaram (Hostel Warden)',
    'urgent',
    now() + interval '14 days',
    false,
    now() - interval '1 day'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'Special Sunday Feast Voting Open',
    'Vote for this Sunday''s special dessert: Rasmalai vs Moong Dal Halwa. Cast your preference via the Food Improvement tab before Friday 6:00 PM.',
    'mess_manager',
    'Rajesh Verma (Mess Manager)',
    'normal',
    now() + interval '5 days',
    false,
    now() - interval '2 days'
  )
on conflict (id) do nothing;

-- 4. SEED SAMPLE COMPLAINTS FOR SEED STUDENT (a0000000-0000-0000-0000-000000000001)
insert into public.complaints (
    id, tracking_id, student_id, category, description, media_paths, status, escalated, created_at, resolved_at, resolution_note
) values (
    'f0000000-0000-0000-0000-000000000001',
    'FB-2026-00123',
    'a0000000-0000-0000-0000-000000000001',
    'Hygiene',
    'Water dispenser adjacent to Counter 2 leaking constantly, causing wet slippery floor tiles.',
    array[]::text[],
    'in_progress',
    false,
    now() - interval '4 hours',
    null,
    null
), (
    'f0000000-0000-0000-0000-000000000002',
    'FB-2026-00089',
    'a0000000-0000-0000-0000-000000000001',
    'Food Quality',
    'Breakfast sambar was lukewarm on Tuesday morning.',
    array[]::text[],
    'resolved',
    false,
    now() - interval '3 days',
    now() - interval '2 days',
    'Bain-marie heating element was inspected, serviced, and temperature recalibrated to 75°C.'
) on conflict (tracking_id) do nothing;

-- Seed Complaint History
insert into public.complaint_history (complaint_id, status, note, actor_role, changed_at)
values
  ('f0000000-0000-0000-0000-000000000001', 'submitted', 'Ticket registered by student', 'student', now() - interval '4 hours'),
  ('f0000000-0000-0000-0000-000000000001', 'under_review', 'Assigned to Mess Supervisor Rajesh Verma', 'mess_manager', now() - interval '3 hours'),
  ('f0000000-0000-0000-0000-000000000001', 'in_progress', 'Plumber dispatched; caution wet floor signage placed', 'mess_manager', now() - interval '1 hour'),
  ('f0000000-0000-0000-0000-000000000002', 'submitted', 'Ticket registered by student', 'student', now() - interval '3 days'),
  ('f0000000-0000-0000-0000-000000000002', 'in_progress', 'Kitchen technician checking buffet warmers', 'mess_manager', now() - interval '2 days 12 hours'),
  ('f0000000-0000-0000-0000-000000000002', 'resolved', 'Bain-marie heating element repaired and calibrated to 75°C.', 'mess_manager', now() - interval '2 days')
on conflict do nothing;

-- 5. SEED PAST ATTENDANCE (56 meals this month for realistic KPI metrics)
insert into public.attendance (student_id, meal_slot, date, scanned_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'breakfast', current_date - interval '1 day', (current_date - interval '1 day') + time '08:15:00'),
  ('a0000000-0000-0000-0000-000000000001', 'lunch', current_date - interval '1 day', (current_date - interval '1 day') + time '13:05:00'),
  ('a0000000-0000-0000-0000-000000000001', 'dinner', current_date - interval '1 day', (current_date - interval '1 day') + time '20:10:00'),
  ('a0000000-0000-0000-0000-000000000001', 'breakfast', current_date - interval '2 days', (current_date - interval '2 days') + time '08:20:00'),
  ('a0000000-0000-0000-0000-000000000001', 'lunch', current_date - interval '2 days', (current_date - interval '2 days') + time '13:12:00'),
  ('a0000000-0000-0000-0000-000000000001', 'dinner', current_date - interval '2 days', (current_date - interval '2 days') + time '20:25:00')
on conflict (student_id, meal_slot, date) do nothing;
