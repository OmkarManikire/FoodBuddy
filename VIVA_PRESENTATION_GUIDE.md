# 🎓 Food Buddy: Project Defense & Viva Voce Guide

> **Project Name:** Food Buddy  
> **Tagline:** *"Campus Hostel Mess Management & Feedback System — Better Food • Better Hygiene • Better Experience"*  
> **Scope:** Institutional Multi-Role Campus Dining Governance Platform

---

## 1. 30-Second Project Elevator Pitch (Say this first!)

> *"Respected Ma'am/Sir, **Food Buddy** is a centralized, role-governed web platform designed to solve the critical challenges in university hostel dining: food wastage, unaddressed hygiene grievances, and lack of contractor accountability.*  
>  
> *It connects three distinct stakeholders in real time:*  
> 1. ***Students***, *who view live nutritional menus, generate anti-fraud dynamic QR meal passes, and log photo-backed complaints.*  
> 2. ***Mess Managers***, *who scan tokens at turnstiles, view predictive headcounts to prevent food waste, and resolve kitchen issues.*  
> 3. ***Higher Authorities (Wardens & Deans)***, *who monitor SLA adherence, track contractor hygiene ratings, and automatically receive escalated complaints if unresolved within 12 hours.*  
>  
> *The entire system is secured with 2-Step OTP authentication and Postgres Row-Level Security (RLS) to ensure zero unauthorized access."*

---

## 2. Technology Stack & Technical Justifications

| Layer | Technologies Used | Why This Was Chosen (Technical Justification) |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, Modern Vanilla CSS3, ES Modules JavaScript, Tailwind CSS | Ultra-fast load times (<300ms), zero compilation overhead, native browser performance, and complete control over custom glassmorphism design tokens without heavy virtual DOM churn. |
| **Icons & Fonts** | Google Material Symbols Outlined, Inter font family | Standardized, accessible, clean typography designed for high-density enterprise dashboard readability. |
| **Charts & Scanner** | `Chart.js`, `html5-qrcode`, `qrcode.js` | Client-side dynamic QR generation for contactless turnstiles and lightweight data visualization for hygiene/ratings analytics without heavy third-party dependencies. |
| **Backend & Database** | **Supabase** (PostgreSQL 15+) | Enterprise ACID-compliant relational database with native real-time subscriptions, SQL triggers, and strict referential integrity. |
| **Security & Auth** | **PostgreSQL Row Level Security (RLS)** & **GoTrue Auth** | Deny-by-default policy on every table. Users cannot query data outside their role, even if they bypass client-side code. |
| **Serverless Logic** | **Deno / Supabase Edge Functions** | Stateless TypeScript execution for secure tasks: generating and hashing 6-digit OTPs, rate-limiting, and SMTP delivery. Service role keys never leak to the client browser. |
| **Testing Suite** | Node.js native test runner (`scripts/test-rls.mjs`) | 7 automated test suites with 25 assertions covering role mismatch protection, OTP brute-force lockout, and RLS data denial. |

---

## 3. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSER                                    |
|                                                                                   |
|  +------------------------+  +------------------------+  +---------------------+  |
|  |    Student Portal      |  |  Mess Manager Console  |  | Higher Authority    |  |
|  | - Flash QR Meal Token  |  | - Turnstile Scanner    |  | - SLA Escalation    |  |
|  | - Photo Grievance      |  | - Headcount Forecast   |  | - Contractor Scores |  |
|  | - Meal Rating / Ledger |  | - Complaint Triage     |  | - Hygiene Audit Log |  |
|  +-----------+------------+  +-----------+------------+  +----------+----------+  |
|              |                           |                          |             |
|              +---------------------------+--------------------------+             |
|                                          | (HTTPS / WSS Anon Key Only)            |
+------------------------------------------|----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                               SUPABASE CLOUD / BACKEND                            |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  |       Deno Edge Functions      |       |           PostgreSQL 15+           |  |
|  |  (Stateless Service-Role API)  |       |                                    |  |
|  | - send-login-otp               | ----> | - Row-Level Security (RLS)         |  |
|  | - verify-login-otp             |       | - Profiles & Roles Table           |  |
|  | - send-reset-otp               |       | - Pre-approved Student IDs Table   |  |
|  | - reset-password-with-otp      |       | - SQL Security Definier Triggers   |  |
|  +--------------------------------+       +------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Key Role Workflows & Feature Breakdown

### 👨‍🎓 1. Hostel Student Portal (`/student/`)
- **Flash-Pass Dynamic QR Token (`attendance.html` / `index.html`):** Time-sensitive QR pass refreshed dynamically to prevent screenshot sharing or proxy meals.
- **Meal Skip & Attendance Forecast:** Students declare meal attendance in advance (e.g., skipping dinner), allowing the mess to reduce food preparation and eliminate waste.
- **Photo-Backed Grievance System (`complaints/`):** Students lodge hygiene or quality complaints with evidence photos and category tags (Hygiene, Quality, Timing, Quantity).
- **Per-Meal Feedback & Rating Ledger (`rate.html`):** 5-star taste and hygiene ratings logged per meal slot (Breakfast, Lunch, Snacks, Dinner).
- **Weekly Nutritional Menu (`menu.html`):** Displays calories, allergens, and meal timetables.

### 👨‍🍳 2. Mess Manager Console (`/manager/`)
- **Live Turnstile QR Scanner (`qr.html`):** Uses camera/barcode reader via `html5-qrcode` to validate students' dynamic tokens in under 1 second.
- **Predictive Headcount (`attendance.html`):** Shows expected dining numbers based on token claims to optimize cooking volume.
- **Grievance Triage Console (`complaints.html`):** Direct response portal to resolve complaints with time-stamped proof of action.
- **Sanitation Sign-off & Kitchen Checklist (`checklist.html`):** Daily temperature logging, cold-storage checks, and staff hygiene verification.
- **Menu & Notice Management (`menu.html`, `notices.html`):** Real-time broadcast of menu updates and delay circulars.

### 🛡️ 3. Higher Authority / Warden & Dean Console (`/authority/`)
- **12-Hour SLA Escalation Matrix (`escalated.html`):** Unresolved complaints automatically escalate to the Warden/Dean after 12 hours.
- **Contractor Quality Index (`quality.html`):** Cumulative score calculated from student meal reviews, penalizing contractors for quality drops.
- **Surprise Hygiene Audit Log (`audit.html`):** Official inspection ledger for food safety inspections and water purity tests.
- **Contract Governance & Penalties (`governance.html`):** Automatically computes financial penalties against caterers for SLA breaches.
- **Directives Dispatch (`directives.html`):** Formal warden directives sent to contractors with binding resolution deadlines.

---

## 5. Security & Fraud Prevention Mechanisms

1. **Two-Step OTP Authentication:**
   - Step 1: Institutional email + password authentication.
   - Step 2: 6-digit hashed OTP sent to campus email, valid for 5 minutes with a 30-second resend cooldown and 3-attempt lockout.
2. **Immutable Role Guard Trigger:**
   - PostgreSQL trigger (`protect_profile_columns`) prevents client tampering of `profiles.role` or `otp_verified_until`.
3. **Pre-Approved Student Whitelist:**
   - `valid_student_ids` table ensures only enrolled students with valid roll numbers can register; outsiders and duplicate IDs are automatically rejected.
4. **Deny-by-Default Row Level Security (RLS):**
   - Tables like `login_otps` and `valid_student_ids` have zero client policies.
   - `profiles` table requires `is_verified_user() = true` (`otp_verified_until > now()`). Even with valid credentials, unverified sessions cannot read database rows.

---

## 6. Top 15 Viva Voce Questions & Model Answers

### Q1: What problem does Food Buddy solve that existing college ERPs don't?
> **Answer:**  
> *"Traditional college ERPs are generic administrative portals. They do not cater to real-time dining operations. Food Buddy bridges the communication gap between students, kitchen managers, and hostel wardens by providing **real-time headcount forecasting to curb food wastage**, **anti-proxy dynamic QR tokens**, and an **automatic 12-hour complaint escalation matrix** that enforces contractor accountability."*

---

### Q2: Why did you use Supabase instead of Firebase or a custom Node/Express backend?
> **Answer:**  
> *"Supabase provides a relational PostgreSQL database with native Row Level Security (RLS). Unlike Firebase's NoSQL document model, a campus dining system requires relational joins between students, meal tokens, complaints, and contractor metrics. Furthermore, Supabase RLS enforces data permissions directly at the database engine level, eliminating redundant backend boilerplate."*

---

### Q3: Why did you build the frontend using Vanilla JS & Tailwind instead of React or Angular?
> **Answer:**  
> *"For a campus system deployed across student smartphones and turnstile tablets, performance and bundle size are critical. Vanilla JavaScript with native ES Modules loads in milliseconds with zero framework runtime overhead or bundle dependencies. It prevents mobile browser crashes in weak Wi-Fi dining halls while remaining 100% modular and maintainable."*

---

### Q4: How does Food Buddy prevent food wastage in the mess?
> **Answer:**  
> *"Through the **Meal Attendance & Skip feature**. Students can mark advance absence for upcoming meals (e.g., weekend leaves or fasting). The Mess Manager console aggregates these claims into a predictive headcount graph before cooking begins, allowing chefs to adjust ingredient quantities accurately."*

---

### Q5: How do you prevent students from sharing meal tokens or taking multiple plates?
> **Answer:**  
> *"We use **single-use dynamic QR meal passes**. When generated, the QR code contains an encrypted token hash bound to the student ID, the meal slot, and current timestamp. Once scanned at the turnstile, the database marks the token as used (`used = true`). Any duplicate scan immediately flags as already claimed."*

---

### Q6: What happens if a student logs a complaint and the mess manager ignores it?
> **Answer:**  
> *"Food Buddy has an **Automated SLA Escalation Matrix**. Each complaint carries a timestamp and SLA timer (typically 12 hours). If the mess manager does not change the status to 'Resolved' with photo evidence within 12 hours, the ticket automatically escalates to the Higher Authority (Hostel Warden / Dean) dashboard with an SLA breach flag."*

---

### Q7: What is Row Level Security (RLS) and how is it used in your project?
> **Answer:**  
> *"Row Level Security is a PostgreSQL engine feature that restricts which rows a user can SELECT, INSERT, UPDATE, or DELETE based on their authenticated identity (`auth.uid()`). In Food Buddy, RLS ensures students can only see their own passes and complaints, managers can only view their mess hall data, and authorities can view campus-wide analytics."*

---

### Q8: What happens if someone tries to hack the client and change their role from 'student' to 'authority'?
> **Answer:**  
> *"Client-side role tampering has zero effect. In the database, a PostgreSQL trigger (`protect_profile_columns`) blocks any `UPDATE` on the `role` column. Furthermore, all RLS policies verify `get_user_role()` from the secure server profile, not from localStorage or client cookies."*

---

### Q9: How does the 2-step OTP login work securely?
> **Answer:**  
> *"When a user inputs their password, the client calls the `send-login-otp` Deno Edge Function. The function generates a cryptographically secure 6-digit random code, hashes it using SHA-256 with a secret salt, and stores only the hash in the `login_otps` table with a 5-minute expiry. Plaintext OTPs are never stored in the database."*

---

### Q10: How do you prevent brute-force guessing of the OTP?
> **Answer:**  
> *"In the `verify-login-otp` Edge Function, we track `attempts`. If a user enters an incorrect OTP 3 consecutive times, the OTP is invalidated immediately and the account requires a new login cycle. Additionally, a 30-second rate-limiting cooldown prevents rapid requests."*

---

### Q11: What if a person who is not a university student tries to register on Food Buddy?
> **Answer:**  
> *"Registration is protected by the `valid_student_ids` institutional whitelist table. During signup, the database verifies if the student ID exists and has not already been registered (`used = false`). If an outsider submits a fabricated roll number, registration is rejected with an error."*

---

### Q12: How does the Higher Authority assess caterer performance?
> **Answer:**  
> *"The Authority console calculates a real-time **Contractor Food Quality Index (FQI)** based on cumulative student ratings (cleanliness, taste, nutrition), temperature inspection logs, and SLA resolution compliance. If the rating drops below 3.5/5, the system automatically suggests contractual penalties."*

---

### Q13: How does the system handle different meal slots (Breakfast, Lunch, Snacks, Dinner)?
> **Answer:**  
> *"Meal slots are governed by time-window logic. Each meal slot has defined operational hours. Tokens generated for Breakfast expire before Lunch begins. The rating system also unlocks feedback only during or shortly after the respective meal window."*

---

### Q14: What testing did you perform to ensure the system is bug-free?
> **Answer:**  
> *"We implemented an automated test suite (`npm run test:rls`) containing 7 test suites and 25 security assertions. It verifies password validation, role mismatch detection, OTP rate limits, invalid student rejection, and immediate data cutoff upon logout."*

---

### Q15: What are the future enhancements for Food Buddy?
> **Answer:**  
> *"Future milestones include:  
> 1. AI-driven computer vision cameras over tray return belts to quantify plate waste.  
> 2. Biometric turnstile integration with RFID campus smart cards.  
> 3. Automated inventory procurement linked directly to local mandi wholesale pricing APIs."*

---

## 7. Recommended 3-Minute Live Demo Flow

1. **Step 1: Landing Page (`/`)**
   - Show the responsive, atmospheric landing page.
   - Point out the 3 role entry cards: **Hostel Student**, **Mess Manager**, and **Higher Authority**.
   - Show the **Interactive Live Feedback Demo** widget at the bottom to demonstrate responsiveness.

2. **Step 2: Role-Governed Login (`/login.html`)**
   - Click **Enter Student Portal**. Notice the tab shifts to Student with green theme.
   - Click the Manager tab (switches to blue theme) or Authority tab (switches to amber theme).
   - Use the pre-seeded credentials or autofill demo buttons to show the 2-step OTP screen.

3. **Step 3: Student Dashboard (`/student/`)**
   - Show today's active meal token QR code.
   - Demonstrate the weekly nutritional menu and lodge a quick demo complaint with a photo tag.

4. **Step 4: Mess Manager Console (`/manager/`)**
   - Show the turnstile QR Scanner (`/manager/qr.html`) verifying a meal pass.
   - Show the Headcount Attendance forecast for dinner and the complaint triage board.

5. **Step 5: Authority Console (`/authority/`)**
   - Show campus dining SLA health score (e.g., 99.2% resolution).
   - Show the 12-hour escalation log and contractor hygiene ratings ledger.
