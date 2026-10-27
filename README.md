# Food Buddy

> **Campus Hostel Mess Management & Feedback System**  
> *"Better Food • Better Hygiene • Better Experience"*

Food Buddy is a modern SaaS web application designed for campus hostel messes, supporting three distinct roles:
1. **Student** — View daily menus, submit meal feedback & hygiene ratings, raise complaints, and track mess tokens.
2. **Mess Manager** — Manage daily menus, inventory logs, verify meal tokens, and address student complaints.
3. **Higher Authority (Hostel Warden / Dean)** — Oversee campus-wide hygiene audits, satisfaction ratings, escalation logs, and contract SLAs.

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla HTML5, modern CSS3 (Custom Design System with CSS variables), ES Modules JavaScript, Chart.js, html5-qrcode, qrcode generator, Supabase JS CDN (`@supabase/supabase-js`).
- **Backend:** Supabase (PostgreSQL, GoTrue Auth, Row Level Security, Edge Functions with Deno).
- **Design System:** Directly converted from Stitch Project (`9981852050064746159`), stored in `/design/login/`.

---

## 📂 Directory Structure

```
Food Buddy/
├── public/                     # Static frontend files served on http://localhost:3000
│   ├── index.html              # Landing page
│   ├── login.html              # Multi-role login screen (Student / Manager / Authority)
│   ├── verify-otp.html         # 6-box OTP verification with timer & cooldown
│   ├── register.html           # Student registration with institutional ID check
│   ├── forgot-password.html    # 3-step OTP password recovery flow
│   ├── student/                # Student Dashboard Portal
│   ├── manager/                # Mess Manager Operations System
│   ├── authority/              # Higher Authority Administrative Desk
│   ├── css/
│   │   └── main.css            # Design tokens, typography, app shell, glassmorphism
│   └── js/
│       ├── config.js           # Supabase URL & publishable anon key config
│       ├── supabase.js         # Supabase client initializer
│       ├── auth.js             # Authentication & Edge Function client methods
│       └── app-shell.js        # Reusable SaaS shell (sidebar, topbar, toasts, modals)
├── supabase/
│   ├── migrations/             # Migration files applied in dependency order
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_functions_and_triggers.sql
│   │   ├── 003_rls_policies.sql
│   │   └── 004_fix_handle_new_user.sql
│   └── functions/              # Deno Edge Functions
│       ├── send-login-otp/
│       ├── verify-login-otp/
│       ├── send-reset-otp/
│       └── reset-password-with-otp/
├── scripts/
│   ├── dev_server.mjs          # Native Node HTTP static server
│   ├── seed.mjs                # Admin API seed script for initial accounts
│   ├── test-rls.mjs            # Automated security, role & RLS test suite
│   └── verify_syntax.mjs       # Syntax linter for JS, JSON, and SQL
├── design/login/               # Stitch design system, DESIGN.md, and screen exports
├── .env.example                # Template for local environment variables
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Dev Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Run Automated Security & RLS Tests
```bash
npm run test:rls
```
Runs the 7 security test suites (25 assertions) verifying:
- Password-only data denial (strict RLS)
- Role tab validation & mismatch blocking
- Outsider / invalid Student ID rejection
- OTP generation, hashing, rate-limiting & 30s cooldown
- 3 wrong attempts lockout
- Full login flow for all three roles
- Immediate RLS denial upon logout (`clear_otp_verification()`)

### 4. Verify Syntax
```bash
npm run check
```

---

## 🔑 Pre-Seeded Test Accounts

| Role | Email | Password | Student ID / Details |
| :--- | :--- | :--- | :--- |
| **Student** | `student@foodbuddy.test` | `Student@Pass2025` | `2025CSB1001` (Mandakini Hostel, Room B-314) |
| **Mess Manager** | `manager@foodbuddy.test` | `Manager@Pass2025` | Rajesh Verma (Central Mess-1) |
| **Higher Authority** | `authority@foodbuddy.test` | `Authority@Pass2025` | Dr. Meenakshi Sundaram (Hostel Warden) |

*In local development mode (`localhost`), OTP codes are displayed via the Demo banner / Function logs with an instant **"Autofill Demo OTP"** button for fast testing. In production, this banner is completely removed and codes are strictly emailed.*

---

## 🔒 Security Architecture

1. **Deny-by-Default RLS on Every Table:**
   - Client access to `valid_student_ids` and `login_otps` is **100% blocked** (zero client policies).
   - `profiles` table access requires `is_verified_user() = true` (`otp_verified_until > now()`). A correct password alone yields 0 rows.
2. **Immutable Role Guard:**
   - A PostgreSQL trigger on `auth.users` (`handle_new_user`) strictly prevents users from assigning themselves `mess_manager` or `authority` roles.
   - Student signups are validated against institutional pre-approved IDs in `valid_student_ids`, rejecting outsiders and duplicates.
   - Column modifications on `profiles.role` and `profiles.otp_verified_until` are blocked by a row-level trigger (`protect_profile_columns`).
3. **No Service Role Keys in Client Code:**
   - The frontend uses only the publishable `anon` key.
   - The `service_role` key is restricted strictly to Edge Functions and the gitignored local `.env`.

---

## 📧 Production Gmail SMTP Configuration

To deliver OTP emails in production:
1. Generate an App Password in your Google Account:
   - Go to **Google Account Settings → Security → 2-Step Verification → App passwords**.
   - Create a new App Password named `Food Buddy Supabase`.
2. Set the secrets in your Supabase project dashboard or CLI:
   ```bash
   supabase secrets set SMTP_USER="your-email@gmail.com" SMTP_PASS="your-16-char-app-password"
   ```
If these secrets are not configured, the Edge Functions gracefully log the OTP to function logs so local and staging testing remains unblocked.
# FoodBuddy
