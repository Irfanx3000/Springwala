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
    bindAddAdmin(); 
    document.getElementById('refresh-requests-btn')?.addEventListener('click', loadRequestsList);
  }
  bindSettingsEvents();
});

async function loadRequestsList() {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;
  try {
    const data = await api.get('/admin/requests');
    if (!data || !data.requests) return;
    
    // Show all except completed/rejected
    const active = data.requests.filter(r => ['pending', 'approved', 'verified'].includes(r.status));
    
    if (active.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No active access requests.</td></tr>';
      return;
    }

    tbody.innerHTML = active.map(r => {
      let statusBadge = '';
      let actions = '';
      let roleDisplay = `<span class="text-sm text-gray-500 capitalize">${r.role}</span>`;

      if (r.status === 'pending') {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">Pending</span>`;
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
      else if (r.status === 'approved' || r.status === 'verified') {
        if (!r.adminExists) {
          statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">Waiting for Setup</span>`;
          actions = `<button onclick="rejectRequest('${r._id}')" class="text-red-400 text-xs hover:underline">Cancel Request</button>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">Onboarded</span>`;
          actions = `<span class="text-gray-400 text-xs italic">Manage in Admin List</span>`;
        }
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
  } catch (err) { console.error(err.message); }
}

async function loadAdminsList() {
  const tbody = document.getElementById('admins-tbody');
  if (!tbody) return;
  try {
    const data = await api.get('/admin/all');
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
  } catch (err) { console.error(err.message); }
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
    try { await api.patch(`/admin/${id}/toggle`); showToast('Status updated', 'success'); await loadAdminsList(); }
    catch (err) { showToast(err.message, 'error'); }
  });
}

function deleteAdminById(id, name) {
  showConfirm(`Permanently delete admin "<strong>${name}</strong>"?`, async () => {
    try { await api.delete(`/admin/${id}`); showToast('Admin deleted', 'success'); await loadAdminsList(); }
    catch (err) { showToast(err.message, 'error'); }
  });
}

function bindSettingsEvents() {
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

  document.getElementById('change-password-btn')?.addEventListener('click', async () => {
    const curr    = document.getElementById('current-password')?.value;
    const newPass = document.getElementById('new-password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;
    if (!curr || !newPass) { showToast('All password fields required', 'error'); return; }
    if (newPass !== confirm) { showToast('New passwords do not match', 'error'); return; }
    if (newPass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    try {
      await api.put('/auth/admin/change-password', { currentPassword: curr, newPassword: newPass });
      showToast('Password changed!', 'success');
      ['current-password','new-password','confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    showConfirm('Are you sure you want to logout?', Auth.logout);
  });
}
