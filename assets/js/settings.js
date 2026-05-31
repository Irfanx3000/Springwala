/**
 * settings.js
 * Matches: admin/settings.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar(); initAdminHeader();
  await loadProfile();
  
  const admin = Auth.getAdmin();
  if (admin?.role === 'superadmin') { 
    await loadAdminsList(); 
    await loadRequestsList();
    await loadSiteSettingsAdmin();
    bindAddAdmin(); 
    document.getElementById('refresh-requests-btn')?.addEventListener('click', loadRequestsList);
  } else {
    // Hide superadmin-only tabs/sections if not superadmin
    document.getElementById('tab-admins')?.classList.add('hidden');
    document.getElementById('content-site')?.classList.add('hidden');
    document.getElementById('tab-site')?.classList.add('hidden');
    // Default to profile tab
    document.getElementById('tab-profile')?.click();
  }
  
  bindSettingsEvents();
  bindSiteSettingsEvents();
});

// ─── ADMIN REQUESTS ──────────────────────────────────────────────────────────

async function loadRequestsList() {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;
  try {
    const data = await api.get('/admin/requests');
    if (!data || !data.requests) return;
    
    const active = data.requests.filter(r => ['awaiting_approval', 'approved'].includes(r.status));
    
    if (active.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No pending access requests.</td></tr>';
      return;
    }

    tbody.innerHTML = active.map(r => {
      let statusBadge = '';
      let actions = '';
      let roleDisplay = `<span class="text-sm text-gray-500 capitalize">${r.role}</span>`;

      if (r.status === 'awaiting_approval') {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Pending Approval</span>`;
        roleDisplay = `
          <select id="role-select-${r._id}" class="bg-gray-100 border-none rounded px-2 py-1 text-sm outline-none">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="superadmin">Superadmin</option>
          </select>`;
        actions = `
          <button onclick="approveRequest('${r._id}')" class="text-green-600 font-semibold text-sm hover:underline">Approve</button>
          <button onclick="rejectRequest('${r._id}')" class="text-red-500 font-semibold text-sm hover:underline">Reject</button>`;
      } 
      else if (r.status === 'approved') {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">Approved</span>`;
        actions = `<span class="text-gray-400 text-xs italic">Manage in Admin List</span>`;
      }

      return `
        <tr class="hover:bg-gray-50 transition border-b border-gray-50">
          <td class="px-4 py-4">
            <p class="font-medium text-gray-800">${r.name}</p>
            <p class="text-xs text-gray-500">${new Date(r.createdAt).toLocaleString()}</p>
          </td>
          <td class="px-4 py-4 text-gray-600 text-sm">${r.email}</td>
          <td class="px-4 py-4">${statusBadge}</td>
          <td class="px-4 py-4">${roleDisplay}</td>
          <td class="px-4 py-4">
            <div class="flex gap-3 items-center">
              ${actions}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) { 
    console.error('Failed to load requests:', err); 
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-red-400">Failed to load requests.</td></tr>';
  }
}

async function approveRequest(requestId) {
  const role = document.getElementById(`role-select-${requestId}`)?.value || 'admin';
  try {
    const res = await api.post('/admin/approve', { requestId, role });
    if (res.success) {
      showToast('Admin approved successfully', 'success');
      await loadRequestsList();
      await loadAdminsList();
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    showToast('Approval failed: ' + err.message, 'error');
  }
}

async function rejectRequest(requestId) {
  if (!confirm('Are you sure you want to reject this request?')) return;
  try {
    const res = await api.post('/admin/reject', { requestId });
    if (res.success) {
      showToast('Request rejected', 'info');
      await loadRequestsList();
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    showToast('Rejection failed: ' + err.message, 'error');
  }
}

// ─── ADMIN PROFILE ────────────────────────────────────────────────────────────

async function loadProfile() {
  try {
    const data = await api.get('/auth/admin/me');
    if (!data) return;
    const a = data.admin;
    setText('profile-name', a.name);
    setText('profile-email', a.email);
    setText('profile-role', a.role);
    const nameEl  = document.getElementById('edit-name-input');
    const emailEl = document.getElementById('edit-email-input');
    if (nameEl)  nameEl.value  = a.name;
    if (emailEl) emailEl.value = a.email;
    
    // Avatar Initials
    const initials = a.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const avatarEl = document.getElementById('profile-avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;
  } catch (err) { console.error('Failed to load profile:', err.message); }
}

// ─── ADMIN LIST ───────────────────────────────────────────────────────────────

async function loadAdminsList() {
  const tbody = document.getElementById('admins-tbody');
  if (!tbody) return;
  try {
    const data = await api.get('/settings/admins');
    if (!data) return;
    const me = Auth.getAdmin();
    tbody.innerHTML = data.admins.map(a => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 ${a._id === me?.id ? 'bg-blue-50/20' : ''}">
        <td class="px-4 py-3">
          <p class="font-['Roboto'] font-medium text-[15px]">${a.name} ${a._id === me?.id ? '<span class="text-xs text-blue-500">(you)</span>' : ''}</p>
        </td>
        <td class="px-4 py-3 text-[14px] text-gray-600">${a.email}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${a.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : a.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}">
            ${a.role}
          </span>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">
            ${a.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="px-4 py-3">
          ${a._id !== me?.id ? `
            <div class="flex gap-2">
              <button onclick="toggleAdminById('${a._id}','${a.name.replace(/'/g,"\\'")}' )" class="text-[12px] px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition">${a.isActive ? 'Deactivate' : 'Activate'}</button>
              <button onclick="deleteAdminById('${a._id}','${a.name.replace(/'/g,"\\'")}')" class="text-[12px] px-3 py-1 border border-red-100 rounded hover:bg-red-50 text-red-500 transition">Delete</button>
            </div>` : '<span class="text-gray-400 text-xs">Current session</span>'}
        </td>
      </tr>`).join('');
  } catch (err) { console.error('Failed to load admins:', err.message); }
}

function bindAddAdmin() {
  document.getElementById('add-admin-btn')?.addEventListener('click', async () => {
    const name     = document.getElementById('add-admin-name')?.value?.trim();
    const email    = document.getElementById('add-admin-email')?.value?.trim();
    const password = document.getElementById('add-admin-password')?.value;
    const role     = document.getElementById('add-admin-role')?.value || 'admin';

    if (!name || !email || !password) { showToast('All fields are required', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

    const btn = document.getElementById('add-admin-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

    try {
      await api.post('/admin/create', { name, email, password, role });
      showToast('Admin created!', 'success');
      ['add-admin-name','add-admin-email','add-admin-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      await loadAdminsList();
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Create Admin'; } }
  });
}

async function toggleAdminById(id, name) {
  showConfirm(`Toggle status for admin "<strong>${name}</strong>"?`, async () => {
    try { await api.patch(`/settings/admins/${id}/toggle`); showToast('Status updated', 'success'); await loadAdminsList(); }
    catch (err) { showToast(err.message, 'error'); }
  });
}

function deleteAdminById(id, name) {
  showConfirm(`Permanently delete admin "<strong>${name}</strong>"?`, async () => {
    try { await api.delete(`/settings/admins/${id}`); showToast('Admin deleted', 'success'); await loadAdminsList(); }
    catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

async function loadSiteSettingsAdmin() {
  try {
    const data = await api.get('/settings/site-configuration');
    if (!data || !data.settings) return;
    const s = data.settings;

    // Hydrate fields
    setVal('site-name-input', s.siteName);
    setVal('contact-email-input', s.contactEmail);
    setVal('contact-phone-input', s.contactNumber); // Corrected to contactNumber
    setVal('address-input', s.address);

    setVal('meta-title-input', s.metaTitle);
    setVal('meta-description-input', s.metaDescription);
    setVal('meta-keywords-input', s.metaKeywords);

    // Hydrate social fields from nested object with flat fallback support
    const socials = s.socialLinks || {};
    setVal('instagram-input', socials.instagram !== undefined ? socials.instagram : s.instagram);
    setVal('twitter-input', socials.twitter !== undefined ? socials.twitter : s.twitter);
    setVal('whatsapp-input', socials.whatsapp !== undefined ? socials.whatsapp : s.whatsapp);
    setVal('facebook-input', socials.facebook !== undefined ? socials.facebook : s.facebook);
    setVal('linkedin-input', socials.linkedin !== undefined ? socials.linkedin : s.linkedin);

    // Hydrate branding previews
    const apiBase = CONFIG.IMAGE_BASE_URL;
    if (s.logoUrl) document.getElementById('logo-preview').src = s.logoUrl.startsWith('http') ? s.logoUrl : `${apiBase}${s.logoUrl}`;
    if (s.faviconUrl) document.getElementById('favicon-preview').src = s.faviconUrl.startsWith('http') ? s.faviconUrl : `${apiBase}${s.faviconUrl}`;

    // Update timestamps
    const updatedStr = s.updatedAt ? `Last Updated: ${new Date(s.updatedAt).toLocaleDateString()}` : 'Last Updated: --';
    ['site-name','contact-email','contact-phone','address','meta-title','meta-description','meta-keywords','instagram','twitter','whatsapp','facebook','linkedin'].forEach(id => {
      setText(`${id}-updated`, updatedStr);
    });

  } catch (err) {
    console.error('Failed to load site settings:', err);
    showToast('Failed to load site settings', 'error');
  }
}

function bindSiteSettingsEvents() {
  const saveBtn = document.getElementById('save-site-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSiteSettings);
  }

  // Branding Previews
  ['logo-file', 'favicon-file'].forEach(id => {
    const input = document.getElementById(id);
    const preview = document.getElementById(id.replace('-file', '-preview'));
    if (input && preview) {
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => preview.src = e.target.result;
          reader.readAsDataURL(file);
        }
      });
    }
  });
}

async function saveSiteSettings() {
  const btn = document.getElementById('save-site-btn');
  if (btn) { 
    btn.disabled = true; 
    btn.innerHTML = `<span class="flex items-center gap-2">
      <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      Saving...
    </span>`; 
  }

  try {
    const formData = new FormData();
    
    // Mapping model keys to HTML input IDs
    const fieldMap = {
      siteName: 'site-name-input',
      contactEmail: 'contact-email-input',
      contactNumber: 'contact-phone-input', // UI ID is still contact-phone-input but model is contactNumber
      address: 'address-input',
      metaTitle: 'meta-title-input',
      metaDescription: 'meta-description-input',
      metaKeywords: 'meta-keywords-input',
      instagram: 'instagram-input',
      twitter: 'twitter-input',
      whatsapp: 'whatsapp-input',
      facebook: 'facebook-input',
      linkedin: 'linkedin-input'
    };

    for (const [key, id] of Object.entries(fieldMap)) {
      let val = document.getElementById(id)?.value?.trim();
      
      // Normalize social links before saving
      if (['instagram', 'twitter', 'whatsapp', 'facebook', 'linkedin'].includes(key)) {
        val = normalizeExternalUrl(val);
      }

      if (val !== undefined) formData.append(key, val);
    }

    // Handle branding uploads
    const logoFile = document.getElementById('logo-file')?.files[0];
    if (logoFile) formData.append('logo', logoFile);
    
    const faviconFile = document.getElementById('favicon-file')?.files[0];
    if (faviconFile) formData.append('favicon', faviconFile);

    const res = await api.put('/settings/site-configuration', formData);
    if (res && res.success) {
      // Invalidate the storefront session settings cache to force refresh
      sessionStorage.removeItem('sw_site_settings');
      
      showToast('Settings saved successfully', 'success');
      await loadSiteSettingsAdmin();
      // Update global user settings if the loader is present
      if (window.loadSiteSettings) window.loadSiteSettings();
    } else {
      showToast(res?.message || 'Failed to save settings', 'error');
    }
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    if (btn) { 
      btn.disabled = false; 
      btn.textContent = 'Save Changes'; 
    }
  }
}

// ─── SHARED EVENTS ──────────────────────────────────────────────────────────

function bindSettingsEvents() {
  // Profile Updates
  document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
    const name  = document.getElementById('edit-name-input')?.value?.trim();
    const email = document.getElementById('edit-email-input')?.value?.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    try {
      const data = await api.put('/settings/profile', { name, email });
      if (data) {
        const admin = Auth.getAdmin();
        if (admin) { admin.name = name; admin.email = email; Auth.setSession(Auth.getToken(), admin); }
        showToast('Profile updated!', 'success');
        await loadProfile(); initAdminHeader();
      }
    } catch (err) { showToast('Update failed: ' + err.message, 'error'); }
  });

  // Password Changes
  document.getElementById('change-password-btn')?.addEventListener('click', async () => {
    const curr    = document.getElementById('current-password')?.value;
    const newPass = document.getElementById('new-password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;
    if (!curr || !newPass) { showToast('All password fields required', 'error'); return; }
    if (newPass !== confirm) { showToast('New passwords do not match', 'error'); return; }
    if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    try {
      await api.put('/auth/admin/change-password', { currentPassword: curr, newPassword: newPass });
      showToast('Password changed successfully!', 'success');
      ['current-password','new-password','confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  });

  // Logout Confirmation
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    showConfirm('Are you sure you want to logout?', Auth.logout);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt || ''; }

/**
 * Production-grade URL normalizer
 */
function normalizeExternalUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '#') return '';
  let clean = url.trim();
  if (/^(javascript|data|vbscript):/i.test(clean)) return '';

  if (!/^https?:\/\//i.test(clean)) {
    if (/^\d+$/.test(clean.replace(/[+\-\s()]/g, ''))) {
      clean = `https://wa.me/${clean.replace(/[+\-\s()]/g, '')}`;
    } else {
      clean = `https://${clean}`;
    }
  }
  
  try {
    const u = new URL(clean);
    return u.href;
  } catch (e) {
    return '';
  }
}

// Admin Helper UI for Protocols
['instagram-input', 'twitter-input', 'whatsapp-input', 'facebook-input', 'linkedin-input'].forEach(id => {
  const input = document.getElementById(id);
  if (!input) return;
  
  // Create helper text element
  const helper = document.createElement('p');
  helper.className = 'text-[11px] text-blue-500 mt-1 hidden font-medium';
  helper.textContent = 'ℹ️ Protocol (https://) will be added automatically';
  input.parentNode.appendChild(helper);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val && !/^https?:\/\//i.test(val) && !val.startsWith('#')) {
      helper.classList.remove('hidden');
    } else {
      helper.classList.add('hidden');
    }
  });
});
