/**
 * users.js
 * Matches: admin/users.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initAdminHeader();
  await loadUserStats();
  await loadUsers(1);
  bindUserEvents();
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

function viewUserInfo(id) {
    showToast(`User Details: ${id}`, 'info');
}


