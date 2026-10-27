import { signOut, quickDemoLogin, updateOperatorProfile } from './auth.js';
import { getSupabase } from './supabase.js';
import { isLocalDev } from './config.js';

let currentAppProfile = null;
let currentAppRole = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPortalSwitcher(activeRole) {
  const isDev = isLocalDev;
  return `
    <div class="portal-quick-switcher" style="display: inline-flex; align-items: center; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 999px; padding: 2px 4px; gap: 3px; font-size: 11px; font-weight: 700;">
      <a href="/" style="text-decoration: none; padding: 3px 7px; border-radius: 999px; color: #475569; display: flex; align-items: center; gap: 3px;" title="Food Buddy Hub Home">
        <span class="material-symbols-outlined text-[14px]">home</span>
        <span class="hidden md:inline">Hub</span>
      </a>
      <button type="button" onclick="${isDev ? 'window.quickDemoLogin ? window.quickDemoLogin(\'student\') : window.location.href=\'/student/\'' : 'window.location.href=\'/student/\''}" class="portal-switch-btn" style="padding: 3px 8px; border-radius: 999px; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; ${activeRole === 'student' ? 'background: #059669; color: #fff; font-weight: 700;' : 'background: transparent; color: #475569;'}" title="Switch to Student Portal">
        <span>🎓</span><span class="hidden sm:inline">Student</span>
      </button>
      <button type="button" onclick="${isDev ? 'window.quickDemoLogin ? window.quickDemoLogin(\'mess_manager\') : window.location.href=\'/manager/\'' : 'window.location.href=\'/manager/\''}" class="portal-switch-btn" style="padding: 3px 8px; border-radius: 999px; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; ${activeRole === 'mess_manager' ? 'background: #2563EB; color: #fff; font-weight: 700;' : 'background: transparent; color: #475569;'}" title="Switch to Mess Manager OS">
        <span>👨‍🍳</span><span class="hidden sm:inline">Manager</span>
      </button>
      <button type="button" onclick="${isDev ? 'window.quickDemoLogin ? window.quickDemoLogin(\'authority\') : window.location.href=\'/authority/\'' : 'window.location.href=\'/authority/\''}" class="portal-switch-btn" style="padding: 3px 8px; border-radius: 999px; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; ${activeRole === 'authority' ? 'background: #D97706; color: #fff; font-weight: 700;' : 'background: transparent; color: #475569;'}" title="Switch to Higher Authority Desk">
        <span>🏛️</span><span class="hidden sm:inline">Authority</span>
      </button>
    </div>
  `;
}

export function renderDemoBanner(customMessage = null, onAutofill = null, btnLabel = 'Autofill Demo Credentials') {
  if (!isLocalDev) {
    // Strictly removed in production or deployed configuration
    return;
  }

  let existing = document.getElementById('foodbuddy-demo-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'foodbuddy-demo-banner';
  banner.className = 'demo-banner';
  banner.style.cssText = 'position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 9999; max-width: 90vw; width: fit-content;';
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 18px; background: #0F172A; color: #fff; font-size: 12px; border-radius: 999px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); border: 1px solid #334155;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="material-symbols-outlined" style="color: #F59E0B; font-size: 18px;">terminal</span>
        <span style="font-weight: 500;">${customMessage || 'Food Buddy Local Dev Active'}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;" id="demo-banner-actions"></div>
    </div>
  `;

  document.body.appendChild(banner);

  if (onAutofill) {
    const actions = banner.querySelector('#demo-banner-actions');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-autofill-demo';
    btn.style.cssText = 'padding: 4px 12px; font-size: 11px; font-weight: 700; background: #059669; color: #FFFFFF; border: none; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: opacity 0.15s;';
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">auto_fix_high</span><span>${btnLabel}</span>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onAutofill();
    });
    actions.appendChild(btn);
  }
}

let _lastToastMsg = '';
let _lastToastTimestamp = 0;

export function showToast(message, type = 'info') {
  const now = Date.now();
  // Prevent duplicate toast spam within 2.5s
  if (message === _lastToastMsg && (now - _lastToastTimestamp < 2500)) {
    return;
  }
  _lastToastMsg = message;
  _lastToastTimestamp = now;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // If a result toast arrives (success, warning, error), dismiss any transient "Verifying..." info toasts
  if (type !== 'info') {
    const infoToasts = container.querySelectorAll('.toast-info');
    infoToasts.forEach((t) => t.remove());
  }

  // Cap visible toasts to max 3 so they never flood the screen
  while (container.children.length >= 3) {
    container.firstElementChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconName = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">${iconName}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

export async function openEditProfileModal(profile = null, role = null) {
  let userProfile = profile || currentAppProfile;
  let userRole = role || currentAppRole;

  if (!userProfile) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        userProfile = p || { email: session.user.email, name: session.user.user_metadata?.name };
        userRole = userRole || userProfile?.role || session.user.app_metadata?.role;
      }
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
    }
  }

  if (!userRole) {
    if (window.location.pathname.startsWith('/manager')) userRole = 'mess_manager';
    else if (window.location.pathname.startsWith('/authority')) userRole = 'authority';
    else userRole = 'student';
  }

  const existing = document.getElementById('edit-operator-profile-modal');
  if (existing) existing.remove();

  const isMgr = userRole === 'mess_manager' || window.location.pathname.startsWith('/manager');
  const isAuth = userRole === 'authority' || window.location.pathname.startsWith('/authority');

  const currentName = userProfile?.name || userProfile?.full_name || (isMgr ? 'Rameshwar Kumar' : (isAuth ? 'Prof. R. Sengupta' : 'Student'));
  const currentFacility = userProfile?.hostel_block || userProfile?.facility || userProfile?.office || (isMgr ? 'Mess 1 • Vikramshila & Mithila' : (isAuth ? 'Hostel Warden & Dean Office' : 'VIKRAMSHILA'));
  const currentEmail = userProfile?.email || (isMgr ? 'manager@foodbuddy.test' : (isAuth ? 'authority@foodbuddy.test' : 'student@foodbuddy.test'));

  const roleTitle = isMgr ? 'Mess Manager / Kitchen Operations Lead' : (isAuth ? 'Higher Authority / Supervisory Oversight' : 'Student Resident');
  const facilityLabel = isMgr ? 'Assigned Dining Hall / Kitchen Facility' : (isAuth ? 'Department / Administrative Office' : 'Assigned Residence');
  const accentColor = isMgr ? '#2563EB' : (isAuth ? '#D97706' : '#059669');
  const bgLight = isMgr ? '#EFF6FF' : (isAuth ? '#FFFBEB' : '#ECFDF5');

  const modalHtml = `
    <div id="edit-operator-profile-modal" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div class="modal-card modal-animate-in" style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; border: 1px solid #E2E8F0; font-family: 'Inter', -apple-system, sans-serif;">
        
        <!-- Header -->
        <div style="background: ${bgLight}; border-bottom: 1px solid #E2E8F0; padding: 20px 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: ${accentColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <span class="material-symbols-outlined text-[24px]">manage_accounts</span>
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; color: #0F172A; margin: 0 0 2px 0;">Update Official Profile</h3>
              <span style="font-size: 12px; font-weight: 600; color: ${accentColor};">${roleTitle}</span>
            </div>
          </div>
          <button type="button" id="closeOperatorProfileModalBtn" style="border: none; background: transparent; color: #64748B; cursor: pointer; padding: 4px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <span class="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <!-- Form Body -->
        <form id="editOperatorProfileForm" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div id="operatorProfileModalError" style="display: none; padding: 10px 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; color: #991B1B; font-size: 13px; font-weight: 500;"></div>

          <!-- Official Name -->
          <div>
            <label for="opInputFullName" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              Operator / Officer Full Name <span style="color: #DC2626;">*</span>
            </label>
            <div style="position: relative;">
              <span class="material-symbols-outlined" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; color: #94A3B8; pointer-events: none;">badge</span>
              <input type="text" id="opInputFullName" required value="${escapeHtml(currentName)}" placeholder="e.g. Omkar Manikire" style="width: 100%; box-sizing: border-box; padding: 10px 14px 10px 38px; font-size: 14px; font-weight: 500; color: #0F172A; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; outline: none; transition: border-color 0.15s ease;" />
            </div>
            <span style="font-size: 11px; color: #64748B; margin-top: 4px; display: block;">This name will appear on all audit trails, turnstile pass scans, and governance logs.</span>
          </div>

          <!-- Facility / Office -->
          <div>
            <label for="opInputFacility" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              ${facilityLabel} <span style="color: #DC2626;">*</span>
            </label>
            <div style="position: relative;">
              <span class="material-symbols-outlined" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; color: #94A3B8; pointer-events: none;">${isMgr ? 'storefront' : 'account_balance'}</span>
              <input type="text" id="opInputFacility" required value="${escapeHtml(currentFacility)}" placeholder="${isMgr ? 'e.g. Mess 1 • Vikramshila & Mithila' : 'e.g. Chief Warden & Dean Office'}" style="width: 100%; box-sizing: border-box; padding: 10px 14px 10px 38px; font-size: 14px; font-weight: 500; color: #0F172A; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; outline: none; transition: border-color 0.15s ease;" />
            </div>
          </div>

          <!-- Account Email (Read-Only) -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              Registered Account Email
            </label>
            <div style="position: relative;">
              <span class="material-symbols-outlined" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; color: #94A3B8; pointer-events: none;">mail</span>
              <input type="email" disabled value="${escapeHtml(currentEmail)}" style="width: 100%; box-sizing: border-box; padding: 10px 14px 10px 38px; font-size: 13px; color: #64748B; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 10px; cursor: not-allowed;" />
            </div>
            <span style="font-size: 11px; color: #94A3B8; margin-top: 4px; display: block;">Authenticated via Campus ID SSO Gateway.</span>
          </div>

          <!-- Actions -->
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 8px; padding-top: 16px; border-top: 1px solid #F1F5F9;">
            <button type="button" id="cancelOperatorProfileModalBtn" style="padding: 9px 16px; font-size: 13px; font-weight: 600; color: #475569; background: #F1F5F9; border: none; border-radius: 8px; cursor: pointer;">
              Cancel
            </button>
            <button type="submit" id="saveOperatorProfileModalBtn" style="padding: 9px 20px; font-size: 13px; font-weight: 600; color: #ffffff; background: ${accentColor}; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <span class="material-symbols-outlined text-[18px]">check</span>
              <span id="saveOperatorProfileBtnText">Save Profile Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalElem = document.getElementById('edit-operator-profile-modal');
  const closeBtn = document.getElementById('closeOperatorProfileModalBtn');
  const cancelBtn = document.getElementById('cancelOperatorProfileModalBtn');
  const form = document.getElementById('editOperatorProfileForm');
  const saveBtn = document.getElementById('saveOperatorProfileModalBtn');
  const saveBtnText = document.getElementById('saveOperatorProfileBtnText');
  const errDiv = document.getElementById('operatorProfileModalError');

  const closeModal = () => modalElem?.remove();
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modalElem?.addEventListener('click', (e) => {
    if (e.target === modalElem) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.style.display = 'none';

    const newName = document.getElementById('opInputFullName').value.trim();
    const newFacility = document.getElementById('opInputFacility').value.trim();

    if (!newName) {
      errDiv.textContent = 'Please enter your full name.';
      errDiv.style.display = 'block';
      return;
    }

    saveBtn.disabled = true;
    saveBtnText.textContent = 'Saving Changes...';

    try {
      const res = await updateOperatorProfile({ name: newName, facility: newFacility });
      if (!res.success) {
        throw new Error(res.error || 'Failed to update profile');
      }

      // Update in-memory profile
      if (currentAppProfile) {
        currentAppProfile.name = newName;
        currentAppProfile.full_name = newName;
        currentAppProfile.hostel_block = newFacility;
      }
      if (userProfile) {
        userProfile.name = newName;
        userProfile.full_name = newName;
        userProfile.hostel_block = newFacility;
      }

      // Update sidebar DOM elements
      document.querySelectorAll('#sidebarUserName, .user-name').forEach(el => el.textContent = newName);
      document.querySelectorAll('#sidebarUserFacility').forEach(el => el.textContent = newFacility);
      document.querySelectorAll('#topbarFacilityText').forEach(el => el.textContent = newFacility);

      // Update any welcome / greeting header on page
      const mgrTitle = document.getElementById('welcomeManagerTitle');
      if (mgrTitle) {
        mgrTitle.textContent = `${newName} • Operations Lead`;
      }

      showToast('Profile updated successfully!', 'success');
      closeModal();
    } catch (err) {
      errDiv.textContent = err.message || 'Error updating profile';
      errDiv.style.display = 'block';
      saveBtn.disabled = false;
      saveBtnText.textContent = 'Save Profile Changes';
    }
  });
}

export async function initAppShell(activeKey = 'dashboard', profile = null) {
  let navKey = activeKey;
  let userProfile = profile;
  if (typeof activeKey === 'object' && activeKey !== null) {
    navKey = activeKey.activeNav || 'dashboard';
    userProfile = activeKey.user || profile;
  }

  currentAppProfile = userProfile;

  const isManager = (userProfile?.role === 'mess_manager') || window.location.pathname.startsWith('/manager');
  const activeKeyStr = navKey;

  if (isManager) {
    currentAppRole = 'mess_manager';
    document.documentElement.classList.add('theme-manager');
    document.body.classList.add('theme-manager');

    const managerName = userProfile?.name || userProfile?.full_name || 'Operations Lead';
    const managerRole = 'Operations Lead';
    const messLocation = userProfile?.hostel_block || userProfile?.facility || 'Mess 1 • Vikramshila & Mithila';

    // 1. Render Manager Sidebar
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="flex flex-col">
          <div class="sidebar-header">
            <div class="brand-icon" style="background: var(--role-manager, #2563EB);">
              <span class="material-symbols-outlined text-[20px]">restaurant_menu</span>
            </div>
            <div class="flex flex-col">
              <span class="brand-text">Food Buddy</span>
              <span class="role-pill" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;">Operations Lead</span>
            </div>
          </div>

          <div class="sidebar-nav">
            <!-- Overview Group -->
            <div class="nav-group">
              <div class="nav-group-title">Overview</div>
              <a href="/manager/" class="nav-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">space_dashboard</span>
                <span>Overview</span>
              </a>
            </div>

            <!-- Operations Group -->
            <div class="nav-group">
              <div class="nav-group-title">Operations</div>
              <a href="/manager/attendance.html" class="nav-item ${activeKeyStr === 'attendance' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">groups</span>
                <span>Attendance</span>
              </a>
              <a href="/manager/qr.html" class="nav-item ${activeKeyStr === 'qr' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">qr_code_2</span>
                <span>Live QR Kiosk</span>
              </a>
              <a href="/manager/menu.html" class="nav-item ${activeKeyStr === 'menu' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">menu_book</span>
                <span>Menu Management</span>
              </a>
              <a href="/manager/checklist.html" class="nav-item ${activeKeyStr === 'checklist' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">fact_check</span>
                <span>Pre-Meal Checklist</span>
              </a>
            </div>

            <!-- Feedback Group -->
            <div class="nav-group">
              <div class="nav-group-title">Feedback</div>
              <a href="/manager/complaints.html" class="nav-item ${activeKeyStr === 'complaints' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">report_problem</span>
                <span>Complaints Queue</span>
              </a>
              <a href="/manager/ratings.html" class="nav-item ${activeKeyStr === 'ratings' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">insights</span>
                <span>Ratings & Analytics</span>
              </a>
            </div>

            <!-- Communication Group -->
            <div class="nav-group">
              <div class="nav-group-title">Communication</div>
              <a href="/manager/notices.html" class="nav-item ${activeKeyStr === 'notices' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">campaign</span>
                <span>Post Notice</span>
              </a>
            </div>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-badge" id="sidebarUserMenuBtn" data-action="edit-profile" title="Click to Edit Profile">
            <div class="user-avatar" style="background: #EFF6FF; color: #1D4ED8;">
              <span class="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <div class="user-info">
              <span class="user-name" id="sidebarUserName">${managerName}</span>
              <span class="user-meta">${managerRole}</span>
              <span class="user-meta" id="sidebarUserFacility" style="color: #2563EB; font-weight: 500;">${messLocation}</span>
            </div>
            <button type="button" class="icon-button btn-edit-profile" data-action="edit-profile" title="Edit Profile" style="border:none; background:transparent; cursor:pointer;">
              <span class="material-symbols-outlined text-muted text-[18px]">edit</span>
            </button>
          </div>
          <button type="button" class="sidebar-logout-btn btn-logout" id="sidebarLogoutBtn" title="Sign Out of Portal">
            <span class="material-symbols-outlined text-[17px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      `;

      document.getElementById('sidebarUserMenuBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openEditProfileModal(currentAppProfile, 'mess_manager');
      });
    }

    // 2. Render Manager Topbar
    const topbar = document.querySelector('.app-topbar');
    if (topbar) {
      topbar.innerHTML = `
        <div class="breadcrumbs">
          <span>Operations Lead</span>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          <span class="current" id="topbarCurrentTitle">Dining Hall Control</span>
        </div>

        <div class="topbar-actions" style="display: flex; align-items: center; gap: 10px;">
          ${renderPortalSwitcher('mess_manager')}

          <div class="campus-chip" id="topbarCampusChip" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;">
            <span class="material-symbols-outlined text-[16px]">storefront</span>
            <span id="topbarFacilityText">${messLocation}</span>
          </div>

          <button type="button" class="btn btn-secondary btn-sm btn-edit-profile" id="topbarEditProfileBtn" data-action="edit-profile" title="Edit Operator Profile" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; font-weight: 600; border-radius: 8px; border: 1px solid #BFDBFE; background: #EFF6FF; color: #1D4ED8; cursor: pointer;">
            <span class="material-symbols-outlined text-[17px]">manage_accounts</span>
            <span>Edit Profile</span>
          </button>

          <a href="/manager/qr.html" class="btn btn-primary btn-sm" style="padding: 6px 14px; font-size: 13px; background: #2563EB;">
            <span class="material-symbols-outlined text-[18px]">qr_code_2</span>
            <span>Launch Live QR</span>
          </a>

          <button class="icon-button btn-logout" id="topbarLogoutBtn" title="Sign Out">
            <span class="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      `;

      document.getElementById('topbarLogoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
      });
    }

    // 3. Render Manager Mobile Bottom Navigation Bar (Screens 1, 3, 6)
    let mobileBar = document.querySelector('.mobile-tab-bar');
    if (!mobileBar) {
      mobileBar = document.createElement('nav');
      mobileBar.className = 'mobile-tab-bar';
      document.body.appendChild(mobileBar);
    }

    mobileBar.innerHTML = `
      <a href="/manager/" class="mobile-tab-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">space_dashboard</span>
        <span>Overview</span>
      </a>
      <a href="/manager/attendance.html" class="mobile-tab-item ${activeKeyStr === 'attendance' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">groups</span>
        <span>Turnout</span>
      </a>
      <a href="/manager/qr.html" class="mobile-tab-item" style="text-decoration:none;">
        <div class="mobile-qr-floating-btn" style="background: #2563EB;" title="Open Dynamic QR Kiosk">
          <span class="material-symbols-outlined text-[26px]">qr_code_2</span>
        </div>
        <span style="color: #2563EB; font-weight: 600;">Live QR</span>
      </a>
      <a href="/manager/complaints.html" class="mobile-tab-item ${activeKeyStr === 'complaints' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">report_problem</span>
        <span>Review</span>
      </a>
      <a href="/manager/menu.html" class="mobile-tab-item ${activeKeyStr === 'menu' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">menu_book</span>
        <span>Menu</span>
      </a>
    `;

    return;
  }

  // --- Higher Authority (Supervisory Oversight) App Shell ---
  const isAuthority = (userProfile?.role === 'authority') || window.location.pathname.startsWith('/authority');
  if (isAuthority) {
    currentAppRole = 'authority';
    document.documentElement.classList.add('theme-authority');
    document.body.classList.add('theme-authority');

    const authorityName = userProfile?.name || userProfile?.full_name || 'Prof. R. Sengupta';
    const authorityRole = 'Supervisory Oversight';
    const authorityOffice = userProfile?.hostel_block || userProfile?.office || 'Hostel Warden & Dean Office';

    // 1. Render Authority Sidebar
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="flex flex-col">
          <div class="sidebar-header">
            <div class="brand-icon" style="background: var(--role-authority, #D97706);">
              <span class="material-symbols-outlined text-[20px]">policy</span>
            </div>
            <div class="flex flex-col">
              <span class="brand-text">Food Buddy</span>
              <span class="role-pill" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;">Supervisory Oversight</span>
            </div>
          </div>

          <div class="sidebar-nav">
            <!-- Overview Group -->
            <div class="nav-group">
              <div class="nav-group-title">Overview</div>
              <a href="/authority/" class="nav-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">space_dashboard</span>
                <span>Overview</span>
              </a>
            </div>

            <!-- Oversight Group -->
            <div class="nav-group">
              <div class="nav-group-title">Oversight</div>
              <a href="/authority/escalated.html" class="nav-item ${activeKeyStr === 'escalated' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]" style="color: #DC2626;">warning</span>
                <span>Escalated Queue</span>
              </a>
              <a href="/authority/audit.html" class="nav-item ${activeKeyStr === 'audit' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">history_edu</span>
                <span>Full Audit Trail</span>
              </a>
            </div>

            <!-- Analytics Group -->
            <div class="nav-group">
              <div class="nav-group-title">Analytics</div>
              <a href="/authority/quality.html" class="nav-item ${activeKeyStr === 'quality' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">analytics</span>
                <span>Quality Index</span>
              </a>
              <a href="/authority/governance.html" class="nav-item ${activeKeyStr === 'governance' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">gavel</span>
                <span>Caterer Governance</span>
              </a>
            </div>

            <!-- Communication Group -->
            <div class="nav-group">
              <div class="nav-group-title">Communication</div>
              <a href="/authority/directives.html" class="nav-item ${activeKeyStr === 'directives' ? 'active' : ''}">
                <span class="material-symbols-outlined text-[20px]">campaign</span>
                <span>Official Directives</span>
              </a>
            </div>
          </div>
        </div>

        <div class="sidebar-footer">
          <div class="user-badge" id="sidebarUserMenuBtn" data-action="edit-profile" title="Click to Edit Profile">
            <div class="user-avatar" style="background: #FFFBEB; color: #B45309;">
              <span class="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div class="user-info">
              <span class="user-name" id="sidebarUserName">${authorityName}</span>
              <span class="user-meta">${authorityRole}</span>
              <span class="user-meta" id="sidebarUserFacility" style="color: #D97706; font-weight: 500;">${authorityOffice}</span>
            </div>
            <button type="button" class="icon-button btn-edit-profile" data-action="edit-profile" title="Edit Profile" style="border:none; background:transparent; cursor:pointer;">
              <span class="material-symbols-outlined text-muted text-[18px]">edit</span>
            </button>
          </div>
          <button type="button" class="sidebar-logout-btn btn-logout" id="sidebarLogoutBtn" title="Sign Out of Portal">
            <span class="material-symbols-outlined text-[17px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      `;

      document.getElementById('sidebarUserMenuBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openEditProfileModal(currentAppProfile, 'authority');
      });
    }

    // 2. Render Authority Topbar
    const topbar = document.querySelector('.app-topbar');
    if (topbar) {
      topbar.innerHTML = `
        <div class="breadcrumbs">
          <span>Supervisory Oversight</span>
          <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          <span class="current" id="topbarCurrentTitle">Institutional Governance</span>
        </div>

        <div class="topbar-actions" style="display: flex; align-items: center; gap: 10px;">
          ${renderPortalSwitcher('authority')}

          <div class="campus-chip" id="topbarCampusChip" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;">
            <span class="material-symbols-outlined text-[16px]">verified_user</span>
            <span id="topbarFacilityText">${authorityOffice}</span>
          </div>

          <button type="button" class="btn btn-secondary btn-sm btn-edit-profile" id="topbarEditProfileBtn" data-action="edit-profile" title="Edit Supervisory Profile" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; font-weight: 600; border-radius: 8px; border: 1px solid #FDE68A; background: #FFFBEB; color: #B45309; cursor: pointer;">
            <span class="material-symbols-outlined text-[17px]">manage_accounts</span>
            <span>Edit Profile</span>
          </button>

          <a href="/authority/directives.html" class="btn btn-primary btn-sm" style="padding: 6px 14px; font-size: 13px; background: #D97706;">
            <span class="material-symbols-outlined text-[18px]">campaign</span>
            <span>Issue Directive</span>
          </a>

          <button class="icon-button btn-logout" id="topbarLogoutBtn" title="Sign Out">
            <span class="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      `;

      document.getElementById('topbarLogoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
      });
    }

    // 3. Render Authority Mobile Bottom Navigation Bar
    let mobileBar = document.querySelector('.mobile-tab-bar');
    if (!mobileBar) {
      mobileBar = document.createElement('nav');
      mobileBar.className = 'mobile-tab-bar';
      document.body.appendChild(mobileBar);
    }

    mobileBar.innerHTML = `
      <a href="/authority/" class="mobile-tab-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">space_dashboard</span>
        <span>Overview</span>
      </a>
      <a href="/authority/escalated.html" class="mobile-tab-item ${activeKeyStr === 'escalated' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]" style="color: #DC2626;">warning</span>
        <span>Escalated</span>
      </a>
      <a href="/authority/directives.html" class="mobile-tab-item" style="text-decoration:none;">
        <div class="mobile-qr-floating-btn" style="background: #D97706;" title="Issue Directive">
          <span class="material-symbols-outlined text-[26px]">campaign</span>
        </div>
        <span style="color: #D97706; font-weight: 600;">Directives</span>
      </a>
      <a href="/authority/audit.html" class="mobile-tab-item ${activeKeyStr === 'audit' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">history_edu</span>
        <span>Audit</span>
      </a>
      <a href="/authority/governance.html" class="mobile-tab-item ${activeKeyStr === 'governance' ? 'active' : ''}">
        <span class="material-symbols-outlined text-[22px]">gavel</span>
        <span>Vendor</span>
      </a>
    `;

    return;
  }

  // --- Student App Shell ---
  currentAppRole = 'student';
  const studentName = userProfile?.name || userProfile?.full_name || 'Aarav Sharma';
  const studentId = userProfile?.student_id || userProfile?.roll_number || '2025CSB1001';
  const roomMeta = userProfile?.room_no || userProfile?.room_number 
    ? `Room ${userProfile.room_no || userProfile.room_number} • ${userProfile.hostel_block || 'Hostel'}` 
    : 'Hostel Resident';

  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="flex flex-col">
        <div class="sidebar-header">
          <div class="brand-icon">
            <span class="material-symbols-outlined text-[20px]">restaurant</span>
          </div>
          <div class="flex flex-col">
            <span class="brand-text">Food Buddy</span>
            <span class="role-pill">Student</span>
          </div>
        </div>

        <div class="sidebar-nav">
          <div class="nav-group">
            <div class="nav-group-title">Overview</div>
            <a href="/student/" class="nav-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">space_dashboard</span>
              <span>Dashboard Home</span>
            </a>
          </div>

          <div class="nav-group">
            <div class="nav-group-title">Mess</div>
            <a href="/student/menu.html" class="nav-item ${activeKeyStr === 'menu' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">menu_book</span>
              <span>Today's Menu</span>
            </a>
            <a href="/student/attendance.html" class="nav-item ${activeKeyStr === 'attendance' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span>QR Attendance</span>
            </a>
            <a href="/student/rate.html" class="nav-item ${activeKeyStr === 'rate' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">star_rate</span>
              <span>Rate Food</span>
            </a>
          </div>

          <div class="nav-group">
            <div class="nav-group-title">Support</div>
            <a href="/student/complaints/" class="nav-item ${activeKeyStr === 'complaints' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">report_problem</span>
              <span>Complaints</span>
            </a>
            <a href="/student/suggestions.html" class="nav-item ${activeKeyStr === 'suggestions' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">thumb_up</span>
              <span>Food Improvement</span>
            </a>
            <a href="/student/notices.html" class="nav-item ${activeKeyStr === 'notices' ? 'active' : ''}">
              <span class="material-symbols-outlined text-[20px]">campaign</span>
              <span>Notices & Circulars</span>
            </a>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="user-badge" id="sidebarUserMenuBtn" data-action="edit-profile" title="Click to View / Edit Profile">
          <div class="user-avatar">
            <span class="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div class="user-info">
            <span class="user-name" id="sidebarUserName">${studentName}</span>
            <span class="user-meta">${studentId}</span>
            <span class="user-meta" id="sidebarUserFacility">${roomMeta}</span>
          </div>
          <button type="button" class="icon-button btn-edit-profile" data-action="edit-profile" title="Edit Profile" style="border:none; background:transparent; cursor:pointer;">
            <span class="material-symbols-outlined text-muted text-[18px]">edit</span>
          </button>
        </div>
        <button type="button" class="sidebar-logout-btn btn-logout" id="sidebarLogoutBtn" title="Sign Out of Portal">
          <span class="material-symbols-outlined text-[17px]">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    document.getElementById('sidebarUserMenuBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openEditProfileModal(currentAppProfile, 'student');
    });
  }

  const topbar = document.querySelector('.app-topbar');
  if (topbar) {
    topbar.innerHTML = `
      <div class="breadcrumbs">
        <span>Student Portal</span>
        <span class="material-symbols-outlined text-[16px]">chevron_right</span>
        <span class="current" id="topbarCurrentTitle">Campus Dining</span>
      </div>

      <div class="topbar-actions" style="display: flex; align-items: center; gap: 10px;">
        ${renderPortalSwitcher('student')}

        <div class="campus-chip" id="topbarCampusChip">
          <span class="material-symbols-outlined text-[16px]">apartment</span>
          <span id="topbarFacilityText">${userProfile?.hostel_block || 'Hostel Mess'}</span>
        </div>

        <a href="/student/attendance.html" class="btn btn-primary btn-sm" style="padding: 6px 14px; font-size: 13px;">
          <span class="material-symbols-outlined text-[18px]">qr_code</span>
          <span>Scan Attendance</span>
        </a>

        <a href="/student/notices.html" class="icon-button" title="Circulars & Notices">
          <span class="material-symbols-outlined text-[22px]">notifications</span>
          <span class="notification-badge" id="topbarNoticeBadge" style="display: none;">0</span>
        </a>

        <button class="icon-button btn-logout" id="topbarLogoutBtn" title="Sign Out">
          <span class="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    `;

    document.getElementById('topbarLogoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  }

  let mobileBar = document.querySelector('.mobile-tab-bar');
  if (!mobileBar) {
    mobileBar = document.createElement('nav');
    mobileBar.className = 'mobile-tab-bar';
    document.body.appendChild(mobileBar);
  }

  mobileBar.innerHTML = `
    <a href="/student/" class="mobile-tab-item ${activeKeyStr === 'dashboard' ? 'active' : ''}">
      <span class="material-symbols-outlined text-[22px]">space_dashboard</span>
      <span>Home</span>
    </a>
    <a href="/student/menu.html" class="mobile-tab-item ${activeKeyStr === 'menu' ? 'active' : ''}">
      <span class="material-symbols-outlined text-[22px]">menu_book</span>
      <span>Menu</span>
    </a>
    <a href="/student/attendance.html" class="mobile-tab-item" style="text-decoration:none;">
      <div class="mobile-qr-floating-btn" title="Scan QR Token">
        <span class="material-symbols-outlined text-[26px]">qr_code_scanner</span>
      </div>
      <span style="color: var(--primary-emerald); font-weight: 600;">Scan QR</span>
    </a>
    <a href="/student/complaints/" class="mobile-tab-item ${activeKeyStr === 'complaints' ? 'active' : ''}">
      <span class="material-symbols-outlined text-[22px]">report_problem</span>
      <span>Tickets</span>
    </a>
    <a href="/student/notices.html" class="mobile-tab-item ${activeKeyStr === 'notices' ? 'active' : ''}">
      <span class="material-symbols-outlined text-[22px]">campaign</span>
      <span>Notices</span>
    </a>
  `;

  try {
    const supabase = getSupabase();
    const { data: kpi } = await supabase.rpc('get_student_kpis');
    if (kpi && kpi.unread_notices > 0) {
      const badge = document.getElementById('topbarNoticeBadge');
      if (badge) {
        badge.textContent = kpi.unread_notices;
        badge.style.display = 'flex';
      }
    }
  } catch (e) {
    // Silent catch
  }
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.showAppNotification = showToast;
  window.initAppShell = initAppShell;
  window.renderDemoBanner = renderDemoBanner;
  window.renderPortalSwitcher = renderPortalSwitcher;
  window.signOut = signOut;
  window.openEditProfileModal = openEditProfileModal;
  window.updateOperatorProfile = updateOperatorProfile;

  // Global document click delegation for all profile and sign out triggers across all roles and pages
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('#sidebarUserMenuBtn, [data-action="edit-profile"], .btn-edit-profile, #topbarEditProfileBtn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      openEditProfileModal(currentAppProfile, currentAppRole);
      return;
    }

    const logoutBtn = e.target.closest('#topbarLogoutBtn, #sidebarLogoutBtn, [data-action="logout"], .btn-logout');
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      signOut();
    }
  });
}

