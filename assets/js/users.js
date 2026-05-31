/**
 * users.js
 * Matches: admin/users.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initAdminHeader();

  const params = new URLSearchParams(window.location.search);
  const userIdParam = params.get('id');
  if (userIdParam) {
    userFilters.search = userIdParam.trim();
    const searchEl = document.getElementById('user-search');
    if (searchEl) searchEl.value = userIdParam.trim();
  }

  await loadUserStats();
  await loadUsers(1);
  bindUserEvents();

  if (userIdParam) {
    viewUserInfo(userIdParam.trim());
  }
});

let currentUserPage = 1;
let userFilters = {};
const USER_LIMIT = 15;

async function loadUserStats() {
  try {
    const data = await api.get('/users/stats');
    if (!data) return;
    const s = data.stats;
    setText('stat-total-users', s.total.toLocaleString());
    setText('stat-active-users', s.active.toLocaleString());
    setText('stat-blocked-users', s.blocked.toLocaleString());
    setText('stat-new-users', s.newLastWeek.toLocaleString());
  } catch (err) { console.error(err.message); }
}

async function loadUsers(page = 1) {
  currentUserPage = page;
  const tbody = document.getElementById('users-tbody');
  const paginationInfo = document.getElementById('pagination-info');
  if (!tbody) return;

  tbody.innerHTML = `<div class="flex justify-center py-20"><div class="animate-spin w-10 h-10 border-4 border-[#BE2229] border-t-transparent rounded-full"></div></div>`;

  try {
    const params = { page, limit: USER_LIMIT, sortBy: 'createdAt', order: userFilters.order || 'desc', ...userFilters };
    delete params.order;
    const data = await api.get('/users', params);
    if (!data) return;

    if (!data.users.length) {
      tbody.innerHTML = `<div class="text-center py-16 text-gray-400 font-['Roboto']">No users found matching your filters.</div>`;
      if (paginationInfo) paginationInfo.textContent = '0–0 of 0';
      return;
    }

    tbody.innerHTML = data.users.map(u => {
        const safeName = (u.name || 'Unknown User').replace(/'/g, "\\'");
        const displayPhoto = u.profileImage || `../assets/images/deafult.png`;
        const activeIcon = u.isActive ? '../assets/icons/admin/block.svg' : '../assets/icons/admin/block.svg'; // Using same icon, but could be different
        const activeClass = u.isActive ? '' : 'grayscale opacity-50';

        return `
        <!-- User Row -->
        <div class="bg-[#F6F6F6] border border-[#DADADA] rounded-[5px] flex flex-col lg:grid lg:grid-cols-[100px_1fr_220px_180px_150px_120px] gap-4 items-center w-full px-4 lg:px-0 py-[12px] hover:bg-white transition-all shadow-sm">
            
            <!-- Mobile Header (Visible only on mobile) -->
            <div class="lg:hidden w-full flex justify-between items-center mb-2 border-b border-black/5 pb-2">
                <span class="font-medium text-sm text-gray-500">User Profile</span>
                <div class="flex items-center gap-4">
                    <img onclick="viewUserInfo('${u._id}')" src="../assets/icons/admin/info.svg" alt="Info" class="w-5 h-5 cursor-pointer hover:scale-110 transition">
                    <img onclick="deleteUserById('${u._id}','${safeName}')" src="../assets/icons/admin/delete.svg" alt="Delete" class="w-4 h-5 cursor-pointer hover:scale-110 transition">
                    <img onclick="toggleUserById('${u._id}','${safeName}')" src="../assets/icons/admin/block.svg" alt="Block" class="w-5 h-5 cursor-pointer hover:scale-110 transition ${u.isActive ? '' : 'invert-[.5] sepia-[1] saturate-[5] hue-rotate-[340deg]'}">
                </div>
            </div>

            <!-- Profile Photo -->
            <div class="w-[80px] h-[80px] rounded-[3px] bg-gray-200 border border-gray-300 flex items-center justify-center overflow-hidden shrink-0 mx-auto lg:ml-4 lg:mr-0">
                <img src="${displayPhoto}" alt="Profile" class="w-full h-full object-cover" onerror="this.src='../assets/images/deafult.png'">
            </div>

            <!-- User Name -->
            <div class="flex flex-col lg:items-center text-center w-full overflow-hidden">
                <span class="lg:hidden text-xs text-gray-400 uppercase">User Name</span>
                <span class="font-['Roboto'] font-normal text-[17px] text-black lg:text-center px-4 truncate w-full">${u.name || '—'}</span>
            </div>

            <!-- Email -->
            <div class="flex flex-col lg:items-center text-center w-full overflow-hidden">
                <span class="lg:hidden text-xs text-gray-400 uppercase">Email ID</span>
                <span class="font-['Roboto'] font-normal text-[17px] text-black truncate w-full">${u.email || '—'}</span>
            </div>

            <!-- Phone -->
            <div class="flex flex-col lg:items-center text-center w-full">
                <span class="lg:hidden text-xs text-gray-400 uppercase">Phone Number</span>
                <span class="font-['Roboto'] font-normal text-[17px] text-black">${u.phone || '—'}</span>
            </div>

            <!-- Date Joined -->
            <div class="flex flex-col lg:items-center text-center w-full">
                <span class="lg:hidden text-xs text-gray-400 uppercase">Date Joined</span>
                <span class="font-['Roboto'] font-normal text-[17px] text-black">${formatDateOnly(u.createdAt)}</span>
            </div>

            <!-- Actions (Desktop Only Layout) -->
            <div class="hidden lg:flex items-center justify-center gap-[20px] w-full">
                <img onclick="viewUserInfo('${u._id}')" src="../assets/icons/admin/info.svg" alt="Info" class="w-5 h-5 cursor-pointer hover:scale-110 transition">
                <img onclick="deleteUserById('${u._id}','${safeName}')" src="../assets/icons/admin/delete.svg" alt="Delete" class="w-4 h-5 cursor-pointer hover:scale-110 transition">
                <img onclick="toggleUserById('${u._id}','${safeName}')" src="../assets/icons/admin/block.svg" alt="Block" class="w-6 h-6 cursor-pointer hover:scale-110 transition ${u.isActive ? '' : 'invert-[.5] sepia-[1] saturate-[5] hue-rotate-[340deg]'}">
            </div>
        </div>`;
    }).join('');

    // Update pagination info
    if (paginationInfo) {
        const start = (page - 1) * USER_LIMIT + 1;
        const end = Math.min(page * USER_LIMIT, data.total);
        paginationInfo.textContent = `${start}–${end} of ${data.total}`;
    }

    buildPagination('users-pagination', page, data.pages || Math.ceil(data.total / USER_LIMIT), (n) => loadUsers(n));
  } catch (err) {
    tbody.innerHTML = `<div class="text-center py-20 text-red-500 font-['Roboto']">Error loading users: ${err.message}</div>`;
  }
}

async function toggleUserById(id, name) {
  showConfirm(`Are you sure you want to ${name.includes('Blocked') ? 'unblock' : 'block/unblock'} <strong>${name}</strong>?`, async () => {
    try {
      const data = await api.patch(`/users/${id}/toggle`);
      showToast(`User ${data.isActive ? 'activated' : 'blocked'} successfully`, 'success');
      await loadUsers(currentUserPage); await loadUserStats();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function deleteUserById(id, name) {
  showConfirm(`Permanently delete user <strong>${name}</strong>? This action cannot be undone.`, async () => {
    try {
      await api.delete(`/users/${id}`);
      showToast('User deleted successfully', 'success');
      await loadUsers(currentUserPage); await loadUserStats();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function bindUserEvents() {
  const searchEl = document.getElementById('user-search');
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { userFilters.search = searchEl.value.trim() || undefined; loadUsers(1); }, 400);
    });
  }

  document.getElementById('user-status-filter')?.addEventListener('change', e => {
    userFilters.isActive = e.target.value || undefined; loadUsers(1);
  });

  document.getElementById('user-sort')?.addEventListener('change', e => {
    userFilters.order = e.target.value; loadUsers(1);
  });

  document.getElementById('refresh-users')?.addEventListener('click', () => {
    loadUserStats(); loadUsers(1);
  });

  const tabAll = document.getElementById('tab-all');
  const tabBlocked = document.getElementById('tab-blocked');

  tabAll?.addEventListener('click', () => {
      userFilters.isActive = undefined;
      tabAll.classList.add('active-tab');
      tabBlocked.classList.remove('active-tab');
      tabBlocked.classList.add('text-[#A4A4A4]');
      loadUsers(1);
  });

  tabBlocked?.addEventListener('click', () => {
      userFilters.isActive = 'false';
      tabBlocked.classList.add('active-tab');
      tabBlocked.classList.remove('text-[#A4A4A4]');
      tabAll.classList.remove('active-tab');
      loadUsers(1);
  });
}

function formatDateOnly(date) {
    if (!date) return '—';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

window.viewUserInfo = async function(id) {
  try {
    const data = await api.get(`/users/${id}`);
    if (!data || !data.success) throw new Error('Failed to load user info');

    const u = data.user;
    const orders = data.orders || [];
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
    const photo = u.profileImage || `../assets/images/deafult.png`;
    const statusText = u.isActive ? 'Active' : 'Blocked';
    const statusColor = u.isActive ? '#16a34a' : '#BE2229';

    // Build recent orders HTML list
    let ordersHtml = '';
    if (orders.length === 0) {
      ordersHtml = `<p style="font-size:14px;color:#888;margin:0;font-family:Roboto,sans-serif">No recent orders found</p>`;
    } else {
      ordersHtml = orders.map(o => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f1f1;font-family:Roboto,sans-serif">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span style="font-weight:600;font-size:14px;color:#1e1e1e">#${o.orderId || o._id}</span>
            <span style="font-size:12px;color:#888">${new Date(o.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
            <span style="font-size:13px;font-weight:600;color:#1a1a1a">${o.orderStatus}</span>
            <span style="font-weight:600;font-size:14px;color:#BE2229">₹${o.totalAmount.toLocaleString()}</span>
          </div>
        </div>
      `).join('');
    }

    // Remove existing modal if any
    document.getElementById('sw-user-modal')?.remove();

    if (!document.getElementById('sw-user-modal-style')) {
      const s = document.createElement('style');
      s.id = 'sw-user-modal-style';
      s.textContent = `
        @keyframes swFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      `;
      document.head.appendChild(s);
    }

    const overlay = document.createElement('div');
    overlay.id = 'sw-user-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);transition:all 0.3s ease';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:Roboto,sans-serif;max-height:90vh;overflow-y:auto;animation:swFadeIn .25s ease-out" class="no-scrollbar">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
          <h3 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:600;margin:0;color:#1a1a1a">User Profile Details</h3>
          <button id="sw-user-modal-close" style="background:none;border:none;cursor:pointer;color:#888;font-size:24px;line-height:1;padding:0">&times;</button>
        </div>
        
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f1f1">
          <img src="${photo}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid #eee" onerror="this.src='../assets/images/deafult.png'">
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:18px;font-weight:600;color:#111">${fullName}</span>
            <span style="font-size:14px;color:#666">${u.email}</span>
            <span style="font-size:13px;font-weight:600;color:${statusColor};background:${statusColor}15;padding:2px 8px;border-radius:100px;width:fit-content">${statusText}</span>
          </div>
        </div>

        <div style="margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Phone Number</span>
            <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">${u.phoneNumber || '—'}</p>
          </div>
          <div>
            <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Member Since</span>
            <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">${new Date(u.createdAt).toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <h4 style="font-family:Poppins,sans-serif;font-size:15px;font-weight:600;margin:0 0 12px;color:#1a1a1a;border-bottom:2px solid #BE2229;padding-bottom:4px;width:fit-content">Recent Orders</h4>
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:20px;max-height:200px;overflow-y:auto" class="no-scrollbar">
          ${ordersHtml}
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:24px">
          <button id="sw-user-modal-ok" style="padding:9px 24px;border:none;border-radius:7px;background:#BE2229;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Close</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('sw-user-modal-close').onclick = () => overlay.remove();
    document.getElementById('sw-user-modal-ok').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  } catch (err) {
    showToast(err.message, 'error');
  }
};


