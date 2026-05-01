/**
 * users.js
 * Matches: admin/users.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar();
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

function buildPagination(containerId, currentPage, totalPages, onPage) {
    const el = document.getElementById(containerId);
    if (!el) return;

    let html = '';
    
    // Previous Button
    html += `
    <button class="w-[23px] h-[23px] bg-white border border-[#EEEEEE] rounded-[2px] flex items-center justify-center hover:bg-gray-50 flex-shrink-0 transition ${currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}" 
            ${currentPage <= 1 ? 'disabled' : ''} 
            onclick="window.onUserPageClick(${currentPage - 1})">
        <svg class="w-3 h-3 text-[#BDBDBD]" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
    </button>`;

    // Simple current page display if many pages, or simple logic
    // For this specific design, we keep it minimal to match the original layout
    
    // Next Button
    html += `
    <button class="w-[23px] h-[23px] bg-white border border-[#E6E6E6] rounded-[2px] flex items-center justify-center hover:bg-gray-50 flex-shrink-0 transition ${currentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}" 
            ${currentPage >= totalPages ? 'disabled' : ''} 
            onclick="window.onUserPageClick(${currentPage + 1})">
        <svg class="w-3 h-3 text-[#2B2B2B]" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
    </button>`;

    el.innerHTML = html;
    window.onUserPageClick = onPage;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function initAdminHeader() {
    const adminName = document.querySelector('.admin-name');
    const user = Auth.getAdmin();
    if (adminName && user) {
        adminName.textContent = user.name || 'Admin';
    }
}

function initSidebar() {
    // Basic sidebar toggle logic is usually in HTML or api.js
}
