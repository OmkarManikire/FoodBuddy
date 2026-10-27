# DESIGN.md — FoodBuddy Design System

## North Star: "Dignified Nourishment & Operational Transparency"
FoodBuddy bridges students, mess contractors, and hostel administrators. It combines the crisp utility of Linear and Notion with the polished trustworthiness of Stripe. High whitespace, crisp 1px borders, subtle elevational shadows, and distinct role-based color coding ensure quick navigation and clear accountability.

---

## 1. Color System

### Base Neutral Palette
- **Page Background (`bg-slate-50`)**: `#F8FAFC`
- **Surface / Card Background (`bg-white`)**: `#FFFFFF`
- **Subtle Surface (`bg-slate-100`)**: `#F1F5F9`
- **Card / Input Border (`border-slate-200`)**: `#E2E8F0`
- **Divider / Subtle Border (`border-slate-100`)**: `#F1F5F9`
- **Primary Text (`text-slate-900`)**: `#0F172A`
- **Secondary / Body Text (`text-slate-700`)**: `#334155`
- **Muted / Caption Text (`text-slate-500`)**: `#64748B`
- **Subtle Icon / Placeholder (`text-slate-400`)**: `#94A3B8`

### Primary Brand (FoodBuddy Core & Student Role)
- **Primary Emerald**: `#059669` (`hover: #047857`, `active: #065F46`)
- **Primary Light Tint**: `#ECFDF5` (`border: #A7F3D0`)
- **Emerald Subtle Text**: `#065F46`

### Role-Based Accent Palette
- **Student**: Emerald `#059669` / Tint `#ECFDF5` (Warm, fresh, approachable)
- **Mess Manager**: Royal Blue `#2563EB` / Tint `#EFF6FF` (Operational, methodical, active)
- **Higher Authority (Warden / Dean)**: Warm Amber `#D97706` / Tint `#FFFBEB` (Governance, supervisory, alert)

### Status Badges (Soft Pills: `px-2.5 py-0.5 rounded-full text-xs font-medium`)
- **Pending**: Amber `#D97706` on `#FEF3C7` (Border `#FDE68A`)
- **In Progress**: Blue `#2563EB` on `#DBEAFE` (Border `#BFDBFE`)
- **Resolved**: Green `#16A34A` on `#DCFCE7` (Border `#BBF7D0`)
- **Escalated**: Crimson `#DC2626` on `#FEE2E2` (Border `#FECACA`)

---

## 2. Typography

- **Font Family**: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Scale**:
  - `Display / Hero`: 36px–44px / bold / tracking-tight
  - `Page Title (H1)`: 24px (1.5rem) / semibold / tracking-tight (`text-slate-900`)
  - `Section Title (H2)`: 18px–20px / semibold (`text-slate-900`)
  - `Card / Modal Title (H3)`: 16px / semibold (`text-slate-900`)
  - `Body Regular`: 14px (0.875rem) / normal / line-height 1.5 (`text-slate-600` or `text-slate-700`)
  - `Body Medium`: 14px / font-medium (`text-slate-800`)
  - `Caption / Subtext`: 12px (0.75rem) / medium or normal (`text-slate-500`)
  - `Micro / Badge`: 11px / font-semibold / uppercase or regular

---

## 3. Elevation & Surfaces

- **Card Container**: `bg-white border border-slate-200 rounded-xl shadow-xs`
- **Subtle Hover Elevation**: `hover:border-slate-300 hover:shadow-sm transition-all duration-150`
- **Modal / Floating Panel**: `bg-white border border-slate-200/80 rounded-2xl shadow-xl`
- **Radii**:
  - Small elements (buttons, inputs, pills, tags): `rounded-lg` (8px)
  - Cards, panels, dialog boxes: `rounded-xl` (12px) to `rounded-2xl` (16px)

---

## 4. Key Component Patterns

### App Shell Architecture
1. **Left Sidebar**: 260px fixed width, `bg-white border-r border-slate-200`. Brand header at top, grouped navigation with active item indicator (`bg-emerald-50 text-emerald-700 font-medium`), user profile badge at bottom with status.
2. **Top Navigation Bar**: 64px height, `bg-white/80 backdrop-blur-md border-b border-slate-200`. Dynamic breadcrumbs, global search command bar (`Cmd+K`), notification bell with counter pill, user dropdown.
3. **Page Content Canvas**: Max container width or responsive fluid grid with generous padding (`p-6` to `p-8`), standard page header with title, subtitle, and primary action group.

### Auth Pages (Split Screen)
- **Left Column (50% desktop, 100% mobile)**: Centered form container (max 420px), role toggle segmented control, clean inputs with floating or distinct labels, progress indicator when multistep.
- **Right Column (50% desktop, hidden on mobile)**: Lush mint-to-emerald gradient (`from-emerald-700 via-emerald-800 to-teal-900`), FoodBuddy monogram and tagline ("Better Food • Better Hygiene • Better Experience"), 3 glassmorphic testimonial / highlight cards detailing QR Attendance, Complaint SLAs, and Audit reports.
