# Food Buddy — Production Deployment Guide (Vercel + Supabase)

This guide provides step-by-step instructions to deploy Food Buddy to Vercel as a high-performance static web application connected to your live Supabase backend (`iycdsjnvdnvayspgqaor`).

---

## 1. Push Code to GitHub

> [!NOTE]
> Git is already initialized locally with all sensitive files (`.env`, `node_modules`, `supabase/.temp`, logs) strictly ignored in `.gitignore`.

Open your terminal in the Food Buddy workspace and run:

```bash
# 1. Create a new repository on GitHub (e.g. named 'food-buddy')
# 2. Add your GitHub remote (replace with your actual GitHub username/repo)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/food-buddy.git

# 3. Rename branch to main if not already
git branch -M main

# 4. Push your commit to GitHub
git push -u origin main
```

---

## 2. Import Project in Vercel

1. Log in to [Vercel](https://vercel.com).
2. On your Vercel Dashboard, click **Add New...** &rarr; **Project**.
3. Locate your `food-buddy` repository from GitHub and click **Import**.
4. Configure Project Settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (runs `scripts/build-config.mjs` automatically)
   - **Output Directory**: `public` (defined in `vercel.json`)

---

## 3. Configure Environment Variables in Vercel

Under the **Environment Variables** section in the Vercel project import screen, add the following two public variables:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `https://iycdsjnvdnvayspgqaor.supabase.co` | Supabase Project API endpoint |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Rzam52ZG52YXlzcGdxYW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY4NDIsImV4cCI6MjEwNzMxMjg0Mn0.jfRSAMmW_QJahx0rOh1cXFZJp4SuqoHYxJ7IuutUQPs` | Supabase Public / Anon Key |

> [!CAUTION]
> **NEVER add `SUPABASE_SERVICE_ROLE_KEY`**, `SMTP_PASS`, or the Google OAuth Client Secret to Vercel!
> The frontend is a public client and must only ever have the publishable anon key. All privileged operations and OTP email dispatches happen inside Supabase Edge Functions.

Click **Deploy**. Once the build finishes, Vercel will assign your live domain (e.g. `https://food-buddy-yourname.vercel.app`). Note this domain as `YOUR-VERCEL-DOMAIN`.

---

## 4. Update Supabase URL Configuration

Now that you have your live Vercel domain (`https://YOUR-VERCEL-DOMAIN.vercel.app`):

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select project **`iycdsjnvdnvayspgqaor`**.
2. In the left sidebar, navigate to **Authentication** &rarr; **URL Configuration**.
3. Update the following fields:
   - **Site URL**:
     ```
     https://YOUR-VERCEL-DOMAIN.vercel.app
     ```
   - **Redirect URLs** (Add each of these):
     ```
     https://YOUR-VERCEL-DOMAIN.vercel.app/**
     https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback
     http://localhost:3000/**
     http://localhost:3000/auth/callback
     ```
4. Click **Save**.

---

## 5. Update Google Cloud Console OAuth Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Google Cloud project and go to **APIs & Services** &rarr; **Credentials**.
3. Under **OAuth 2.0 Client IDs**, click your web client.
4. Under **Authorized JavaScript origins**, ensure the following are listed:
   - `https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `https://iycdsjnvdnvayspgqaor.supabase.co`
   - `http://localhost:3000` (for local development)
5. Under **Authorized redirect URIs**, ensure the following are listed:
   - `https://iycdsjnvdnvayspgqaor.supabase.co/auth/v1/callback`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback`
6. Click **Save**.

---

## 6. Confirm Supabase Edge Function Secrets & Google Provider

1. **Google Auth Provider**:
   - In Supabase Dashboard &rarr; **Authentication** &rarr; **Providers** &rarr; **Google**:
   - Verify that **Enable Google provider** is switched **ON**.
   - Ensure the Google **Client ID** and **Client Secret** match your Google Cloud Console credentials.
2. **Email OTP Delivery (Gmail SMTP)**:
   - In Supabase Dashboard &rarr; **Project Settings** &rarr; **Edge Functions** (or **Secrets**):
   - Confirm `SMTP_USER` (your Gmail address) and `SMTP_PASS` (16-character Gmail App Password) are configured so the 2FA login OTP emails can be delivered to students, managers, and wardens.

---

## 7. Post-Deployment Verification Checklist

Once deployed, open your live Vercel URL in your browser and verify:

- [ ] **Clean URLs & Routing**:
  - Visit `https://YOUR-VERCEL-DOMAIN.vercel.app/login` &rarr; Loads login page.
  - Visit `https://YOUR-VERCEL-DOMAIN.vercel.app/register` &rarr; Loads registration page.
  - Visit `https://YOUR-VERCEL-DOMAIN.vercel.app/otp` &rarr; Seamlessly serves verification screen.
  - Visit `https://YOUR-VERCEL-DOMAIN.vercel.app/nonexistent-test` &rarr; Shows branded 404 page with return links.
- [ ] **Production Mode**:
  - Verify that local dev autofill banners and demo quick-login buttons are completely absent.
- [ ] **Google Sign-In**:
  - Click **Continue with Google** on the Student login page &rarr; Opens Google consent dialog.
  - For a new student, redirects to `/onboarding` to enter Student ID.
  - For a known Mess Manager / Warden account, authenticates and redirects directly to `/manager/` or `/authority/`.
  - For an unauthorized Google account on the Manager or Authority tab, displays rejection message and terminates the session.
- [ ] **Email + Password & OTP**:
  - Log in with email and password &rarr; Dispatches 6-digit code to email &rarr; Verifies code and grants 12-hour session.
- [ ] **Turnstile Camera Scanner**:
  - On mobile or desktop with webcam, open Student Attendance (`/student/attendance.html`) or Manager Scanner (`/manager/qr.html`).
  - Confirm browser prompts for camera permission (enabled via `Permissions-Policy: camera=(self)` over HTTPS).
