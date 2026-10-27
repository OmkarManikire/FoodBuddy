import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://hyqdrbiqubnjwebiniha.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🌱 Starting Food Buddy Seeding Script...');

if (!serviceRoleKey) {
  console.log('ℹ️ SUPABASE_SERVICE_ROLE_KEY is not set in local .env.');
  console.log('   The database already has pre-seeded accounts and 20 student IDs.');
  console.log('\nDefault Seed Credentials (also active in database):');
  console.log('----------------------------------------------------');
  console.log('Role: STUDENT');
  console.log('Email: student@foodbuddy.test');
  console.log('Password: Student@Pass2025');
  console.log('Student ID: 2025CSB1001');
  console.log('----------------------------------------------------');
  console.log('Role: MESS MANAGER');
  console.log('Email: manager@foodbuddy.test');
  console.log('Password: Manager@Pass2025');
  console.log('----------------------------------------------------');
  console.log('Role: HIGHER AUTHORITY');
  console.log('Email: authority@foodbuddy.test');
  console.log('Password: Authority@Pass2025');
  console.log('----------------------------------------------------');
  console.log('Valid Unused Student IDs (for registration testing):');
  for (let i = 2; i <= 20; i++) {
    const num = String(i).padStart(4, '0');
    console.log(` - 2025CSB${1000 + i}`);
  }
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSeed() {
  console.log('1. Ensuring 20 Valid Student IDs in public.valid_student_ids...');
  const studentIds = [];
  for (let i = 1; i <= 20; i++) {
    studentIds.push({
      student_id: `2025CSB${1000 + i}`,
      used: i === 1, // 1st is used by seed student
    });
  }

  const { error: idError } = await supabase
    .from('valid_student_ids')
    .upsert(studentIds, { onConflict: 'student_id' });

  if (idError) {
    console.error('Error inserting student IDs:', idError.message);
  } else {
    console.log('✅ 20 Valid Student IDs confirmed.');
  }

  const seedAccounts = [
    {
      email: 'student@foodbuddy.test',
      password: 'Student@Pass2025',
      user_metadata: {
        role: 'student',
        name: 'Aarav Patel (Student)',
        student_id: '2025CSB1001',
        room_no: 'B-314',
        hostel_block: 'Block B - Mandakini Hostel',
      },
    },
    {
      email: 'manager@foodbuddy.test',
      password: 'Manager@Pass2025',
      user_metadata: {
        role: 'mess_manager',
        name: 'Rajesh Verma (Mess Manager)',
      },
    },
    {
      email: 'authority@foodbuddy.test',
      password: 'Authority@Pass2025',
      user_metadata: {
        role: 'authority',
        name: 'Dr. Meenakshi Sundaram (Hostel Warden)',
      },
    },
  ];

  console.log('\n2. Provisioning / updating seed accounts via Admin API...');
  for (const acc of seedAccounts) {
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existing = usersData?.users?.find((u) => u.email === acc.email);

    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: acc.password,
        user_metadata: acc.user_metadata,
        email_confirm: true,
      });
      console.log(`✅ Updated existing user: ${acc.email}`);
    } else {
      const { error: createErr } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: acc.user_metadata,
      });
      if (createErr) {
        console.error(`Error creating ${acc.email}:`, createErr.message);
      } else {
        console.log(`✅ Created user: ${acc.email}`);
      }
    }
  }

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\nDefault Seed Credentials:');
  console.log('----------------------------------------------------');
  console.log('Role: STUDENT');
  console.log('Email: student@foodbuddy.test');
  console.log('Password: Student@Pass2025');
  console.log('Student ID: 2025CSB1001');
  console.log('----------------------------------------------------');
  console.log('Role: MESS MANAGER');
  console.log('Email: manager@foodbuddy.test');
  console.log('Password: Manager@Pass2025');
  console.log('----------------------------------------------------');
  console.log('Role: HIGHER AUTHORITY');
  console.log('Email: authority@foodbuddy.test');
  console.log('Password: Authority@Pass2025');
  console.log('----------------------------------------------------');
}

runSeed().catch(console.error);
