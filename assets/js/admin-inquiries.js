/**
 * admin-inquiries.js - Production-grade Inquiries and Subscriptions Admin Controller
 */

// Global State
let currentTab = 'messages'; // 'messages', 'newsletter', 'careers', 'partners', or 'comingSoon'
let messagesPage = 1;
let newsletterPage = 1;
let careersPage = 1;
let partnersPage = 1;
let comingSoonPage = 1;
const recordsPerPage = 10;
let messagesSearch = '';
let newsletterSearch = '';
let careersSearch = '';
let partnersSearch = '';
let comingSoonSearch = '';
let careersFilters = { status: '', position: '', experience: '' };
let partnersFilters = { status: '', category: '' };

// Data store for export
let allInquiriesCached = [];

// Ensure Authenticated
if (typeof Auth !== 'undefined') {
  Auth.requireAuth();
}

/**
 * Switch Active Tab
 */
window.switchTab = function(tabId) {
  currentTab = tabId;
  
  // UI Tabs toggle
  document.getElementById("tab-messages").classList.toggle("active-tab", tabId === 'messages');
  document.getElementById("tab-messages").classList.toggle("text-[#A4A4A4]", tabId !== 'messages');

  document.getElementById("tab-newsletter").classList.toggle("active-tab", tabId === 'newsletter');
  document.getElementById("tab-newsletter").classList.toggle("text-[#A4A4A4]", tabId !== 'newsletter');

  document.getElementById("tab-careers").classList.toggle("active-tab", tabId === 'careers');
  document.getElementById("tab-careers").classList.toggle("text-[#A4A4A4]", tabId !== 'careers');

  if (document.getElementById("tab-partners")) {
    document.getElementById("tab-partners").classList.toggle("active-tab", tabId === 'partners');
    document.getElementById("tab-partners").classList.toggle("text-[#A4A4A4]", tabId !== 'partners');
  }
  if (document.getElementById("tab-coming-soon")) {
    document.getElementById("tab-coming-soon").classList.toggle("active-tab", tabId === 'comingSoon');
    document.getElementById("tab-coming-soon").classList.toggle("text-[#A4A4A4]", tabId !== 'comingSoon');
  }

  // Content Visibility toggle
  document.getElementById("content-messages").classList.toggle("active", tabId === 'messages');
  document.getElementById("content-newsletter").classList.toggle("active", tabId === 'newsletter');
  document.getElementById("content-careers").classList.toggle("active", tabId === 'careers');
  if (document.getElementById("content-partners")) {
    document.getElementById("content-partners").classList.toggle("active", tabId === 'partners');
  }
  if (document.getElementById("content-coming-soon")) {
    document.getElementById("content-coming-soon").classList.toggle("active", tabId === 'comingSoon');
  }

  // Rerender pagination & search for active tab
  const activeSearchInput = document.getElementById("desktop-search-input");
  if (activeSearchInput) {
    if (tabId === 'messages') activeSearchInput.value = messagesSearch;
    else if (tabId === 'newsletter') activeSearchInput.value = newsletterSearch;
    else if (tabId === 'careers') activeSearchInput.value = careersSearch;
    else if (tabId === 'partners') activeSearchInput.value = partnersSearch;
    else if (tabId === 'comingSoon') activeSearchInput.value = comingSoonSearch;
  }
  
  if (tabId === 'messages') {
    fetchInquiries(messagesPage);
  } else if (tabId === 'newsletter') {
    fetchNewsletter(newsletterPage);
  } else if (tabId === 'careers') {
    fetchCareers(careersPage);
  } else if (tabId === 'partners') {
    fetchPartners(partnersPage);
  } else if (tabId === 'comingSoon') {
    fetchComingSoonNotifications(comingSoonPage);
  }
};

/**
 * Format timestamp nicely (e.g. Oct 24, 2026)
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

/**
 * Format detailed date for modal (e.g. Oct 24, 2026, 10:45 AM)
 */
function formatDetailedDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

/**
 * Fetch stats from backend and update UI KPI cards
 */
async function fetchStats() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/stats`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('stat-total-messages').innerText = data.stats.totalMessages.toLocaleString();
      document.getElementById('stat-unread-messages').innerText = data.stats.unreadMessages.toLocaleString();
      document.getElementById('stat-newsletter-subs').innerText = data.stats.newsletterSubs.toLocaleString();
      if (document.getElementById('stat-career-apps')) {
        document.getElementById('stat-career-apps').innerText = (data.stats.careerApps || 0).toLocaleString();
      }
      if (document.getElementById('stat-partner-apps')) {
        document.getElementById('stat-partner-apps').innerText = (data.stats.partnerApps || 0).toLocaleString();
      }
      if (document.getElementById('stat-coming-soon-notifications')) {
        document.getElementById('stat-coming-soon-notifications').innerText = (data.stats.comingSoonNotifications || 0).toLocaleString();
      }
    }
  } catch (err) {
    console.error('[Fetch Stats Error]', err);
  }
}

/**
 * Fetch paginated inquiries from backend
 */
async function fetchInquiries(page = 1) {
  messagesPage = page;
  const tbody = document.getElementById('messages-tbody');
  tbody.innerHTML = `
    <div class="p-8 text-center text-[#656565] font-medium">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE2229] mb-2"></div>
      <div>Loading inquiries...</div>
    </div>
  `;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries?page=${page}&limit=${recordsPerPage}&search=${encodeURIComponent(messagesSearch)}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (!data.inquiries || data.inquiries.length === 0) {
        tbody.innerHTML = `<div class="p-8 text-center text-[#656565] font-medium">No inquiries found.</div>`;
        renderPagination(0, page, recordsPerPage);
        return;
      }

      tbody.innerHTML = '';
      data.inquiries.forEach(inq => {
        const isNew = inq.status === 'Unread';
        const rowBg = isNew ? 'bg-red-50/30' : 'bg-white';
        const badge = isNew ? `<span class="bg-[#BE2229] text-white text-[10px] px-2 py-0.5 rounded-full ml-2 font-['Inter']">New</span>` : '';
        
        // Escape parameters for openMessageModal
        const escName = inq.fullName.replace(/'/g, "\\'");
        const escEmail = inq.email.replace(/'/g, "\\'");
        const escPhone = inq.phoneNumber.replace(/'/g, "\\'");
        const escSubject = inq.subject.replace(/'/g, "\\'");
        const escMsg = inq.message.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
        const formatted = formatDate(inq.createdAt);

        const row = document.createElement('div');
        row.id = `inq-row-${inq._id}`;
        row.className = `flex flex-col lg:grid lg:grid-cols-[120px_1fr_220px_150px_200px_100px] gap-1 lg:gap-4 lg:items-center p-4 lg:px-[28px] lg:py-4 border-b border-gray-100 ${rowBg} lg:hover:bg-gray-50 transition cursor-pointer relative`;
        
        row.innerHTML = `
          <span class="text-[#656565] text-[13px] lg:text-[15px] order-1 lg:order-none">${formatted}</span>
          <span class="text-black font-medium text-[16px] order-2 lg:order-none flex items-center">${inq.fullName} ${badge}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-3 lg:order-none break-all">${inq.email}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-4 lg:order-none">+91 ${inq.phoneNumber}</span>
          <span class="text-black font-medium text-[14px] lg:text-[15px] mt-1 lg:mt-0 truncate order-5 lg:order-none">${inq.subject}</span>
          <div class="absolute right-4 top-4 lg:relative lg:right-auto lg:top-auto flex items-center justify-end lg:justify-center gap-3 order-6 lg:order-none">
            <button
              onclick="viewInquiryDetail('${inq._id}', '${escName}', '${escEmail}', '${escPhone}', '${escSubject}', '${formatDetailedDate(inq.createdAt)}', '${escMsg}', ${isNew})"
              class="text-[#BE2229] hover:underline text-[14px] font-medium bg-red-50 lg:bg-transparent px-3 py-1 lg:px-0 lg:py-0 rounded"
            >
              View
            </button>
          </div>
        `;
        tbody.appendChild(row);
      });

      renderPagination(data.total, page, recordsPerPage);
    } else {
      tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Failed to retrieve inquiries.</div>`;
    }
  } catch (err) {
    console.error('[Fetch Inquiries Error]', err);
    tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Server connection error.</div>`;
  }
}

/**
 * Fetch paginated newsletter subscribers from backend
 */
async function fetchNewsletter(page = 1) {
  newsletterPage = page;
  const tbody = document.getElementById('newsletter-tbody');
  tbody.innerHTML = `
    <div class="p-8 text-center text-[#656565] font-medium">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE2229] mb-2"></div>
      <div>Loading subscribers...</div>
    </div>
  `;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/newsletter?page=${page}&limit=${recordsPerPage}&search=${encodeURIComponent(newsletterSearch)}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (!data.subscribers || data.subscribers.length === 0) {
        tbody.innerHTML = `<div class="p-8 text-center text-[#656565] font-medium">No subscribers found.</div>`;
        if (currentTab === 'newsletter') {
          renderPagination(0, page, recordsPerPage);
        }
        return;
      }

      tbody.innerHTML = '';
      data.subscribers.forEach(sub => {
        const formatted = formatDate(sub.subscribedAt || sub.createdAt);
        const isSubscribed = sub.status === 'Subscribed';
        const statusBadge = isSubscribed 
          ? `<span class="bg-green-100 text-green-700 font-medium text-[12px] px-3 py-1 rounded-full">Subscribed</span>`
          : `<span class="bg-red-100 text-red-700 font-medium text-[12px] px-3 py-1 rounded-full">Unsubscribed</span>`;

        const row = document.createElement('div');
        row.className = `flex flex-col lg:grid lg:grid-cols-[150px_1fr_150px_100px] gap-2 lg:gap-4 lg:items-center p-4 lg:px-[28px] lg:py-4 border-b border-gray-100 lg:hover:bg-gray-50 transition relative`;
        
        row.innerHTML = `
          <span class="text-[#656565] text-[13px] lg:text-[15px] order-1 lg:order-none">${formatted}</span>
          <span class="text-black font-medium text-[16px] order-2 lg:order-none break-all">${sub.email}</span>
          <div class="flex lg:justify-center order-3 lg:order-none mt-1 lg:mt-0">${statusBadge}</div>
          <div class="absolute right-4 top-4 lg:relative lg:right-auto lg:top-auto flex items-center justify-end lg:justify-center gap-3 order-4 lg:order-none">
            <button
              onclick="removeSubscriber('${sub._id}', '${sub.email}')"
              class="text-red-500 hover:text-red-700 transition bg-red-50 lg:bg-transparent p-1.5 lg:p-0 rounded"
              title="Remove Subscriber"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        `;
        tbody.appendChild(row);
      });

      if (currentTab === 'newsletter') {
        renderPagination(data.total, page, recordsPerPage);
      }
    } else {
      tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Failed to retrieve subscribers.</div>`;
    }
  } catch (err) {
    console.error('[Fetch Subscribers Error]', err);
    tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Server connection error.</div>`;
  }
}

async function fetchCareers(page = 1) {
  careersPage = page;
  const tbody = document.getElementById('careers-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <div class="p-8 text-center text-[#656565] font-medium">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE2229] mb-2"></div>
      <div>Loading career applications...</div>
    </div>
  `;

  try {
    const statusVal = document.getElementById('career-filter-status')?.value || '';
    const positionVal = document.getElementById('career-filter-position')?.value || '';
    const experienceVal = document.getElementById('career-filter-experience')?.value || '';

    const queryParams = new URLSearchParams({
      page,
      limit: recordsPerPage,
      search: careersSearch,
      status: statusVal,
      position: positionVal,
      experience: experienceVal
    });

    const res = await fetch(`${CONFIG.API_BASE_URL}/careers?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (!data.applications || data.applications.length === 0) {
        tbody.innerHTML = `<div class="p-8 text-center text-[#656565] font-medium">No applications found matching your criteria.</div>`;
        if (currentTab === 'careers') {
          renderPagination(0, page, recordsPerPage);
        }
        return;
      }

      tbody.innerHTML = '';
      data.applications.forEach(app => {
        const formattedDate = formatDate(app.createdAt);
        
        // Status dropdown options
        const statuses = ['New', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'];
        const statusOptions = statuses.map(s => `
          <option value="${s}" ${app.status === s ? 'selected' : ''}>${s}</option>
        `).join('');

        const escName = app.fullName.replace(/'/g, "\\'");
        const escEmail = app.email.replace(/'/g, "\\'");
        const escPhone = app.phone.replace(/'/g, "\\'");
        const escPosition = app.position.replace(/'/g, "\\'");
        const escExperience = app.experience.replace(/'/g, "\\'");
        const escLocation = app.location.replace(/'/g, "\\'");
        const escCover = app.coverLetter.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
        const resumeDownloadUrl = `${CONFIG.IMAGE_BASE_URL.replace(/\/$/, '')}/${app.resumeUrl}`;

        const row = document.createElement('div');
        row.className = `admin-fixed-grid flex flex-col lg:grid lg:grid-cols-[100px_minmax(0,1.1fr)_minmax(0,1.4fr)_110px_minmax(0,1.2fr)_95px_minmax(0,1fr)_90px_130px_80px] gap-2 lg:gap-3 lg:items-center p-4 lg:px-[28px] lg:py-4 border-b border-gray-100 bg-white hover:bg-gray-50 transition relative font-['Roboto']`;
        row.innerHTML = `
          <span class="text-[#656565] text-[13px] lg:text-[15px] order-1 lg:order-none min-w-0 admin-cell-ellipsis">${formattedDate}</span>
          <span class="text-black font-semibold text-[16px] order-2 lg:order-none min-w-0 admin-cell-ellipsis" title="${app.fullName}">${app.fullName}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-3 lg:order-none min-w-0 admin-cell-ellipsis" title="${app.email}">${app.email}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-4 lg:order-none min-w-0 admin-cell-ellipsis">${app.phone}</span>
          <span class="text-black font-medium text-[14px] lg:text-[15px] order-5 lg:order-none min-w-0 admin-cell-ellipsis" title="${app.position}">${app.position}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-6 lg:order-none capitalize min-w-0 admin-cell-ellipsis">${app.experience}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-7 lg:order-none min-w-0 admin-cell-ellipsis" title="${app.location}">${app.location}</span>
          
          <div class="flex items-center justify-start lg:justify-center order-8 lg:order-none gap-2 min-w-0">
            <a href="${resumeDownloadUrl}" target="_blank" class="text-blue-500 hover:text-blue-700 transition" title="View Resume">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </a>
            <button onclick="downloadResume('${resumeDownloadUrl}', '${escName.replace(/'/g, '').replace(/ /g, '_')}_resume')" class="text-green-500 hover:text-green-700 transition cursor-pointer bg-transparent border-none p-0" title="Download Resume">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </button>
          </div>

          <div class="flex items-center justify-start lg:justify-center order-9 lg:order-none min-w-0">
            <select 
              onchange="updateCareerStatus('${app._id}', this.value)"
              class="border rounded px-2 py-1 text-[13px] bg-white outline-none cursor-pointer font-medium w-full min-w-0 max-w-full truncate"
              style="color: ${getStatusColor(app.status)}; border-color: ${getStatusColor(app.status)}88"
            >
              ${statusOptions}
            </select>
          </div>

          <div class="absolute right-4 top-4 lg:relative lg:right-auto lg:top-auto flex items-center justify-end lg:justify-center gap-3 order-10 lg:order-none font-medium min-w-0">
            <button
              onclick="viewCareerDetail('${app._id}', '${escName}', '${escEmail}', '${escPhone}', '${escPosition}', '${escExperience}', '${escLocation}', '${resumeDownloadUrl}', '${formattedDate}', '${escCover}')"
              class="text-[#BE2229] hover:underline text-[14px] font-bold bg-red-50 lg:bg-transparent px-3 py-1 lg:px-0 lg:py-0 rounded"
            >
              View
            </button>
          </div>
        `;
        tbody.appendChild(row);
      });

      if (currentTab === 'careers') {
        renderPagination(data.total, page, recordsPerPage);
      }
    } else {
      tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Failed to retrieve applications.</div>`;
    }
  } catch (err) {
    console.error('[Fetch Careers Error]', err);
    tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Server connection error.</div>`;
  }
}

function getStatusColor(status) {
  const map = {
    'New': '#2563eb',
    'Shortlisted': '#d97706',
    'Interview Scheduled': '#a78bfa',
    'Selected': '#16a34a',
    'Rejected': '#BE2229'
  };
  return map[status] || '#718096';
}

// Force-download a resume file via fetch+blob (works cross-origin)
window.downloadResume = async function(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'resume';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('[Download Resume Error]', err);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
};

window.updateCareerStatus = async function(id, status) {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/careers/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Status updated successfully!', 'success');
      fetchStats();
      fetchCareers(careersPage);
    } else {
      showToast(data.message || 'Failed to update status.', 'error');
    }
  } catch (err) {
    console.error('[Update Career Status Error]', err);
    showToast('Server error updating status.', 'error');
  }
};

window.viewCareerDetail = function(id, name, email, phone, position, experience, location, resumeUrl, date, coverLetter) {
  // Remove existing modal if any
  document.getElementById('sw-career-detail-modal')?.remove();

  if (!document.getElementById('sw-career-modal-style')) {
    const s = document.createElement('style');
    s.id = 'sw-career-modal-style';
    s.textContent = `
      @keyframes swFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
    `;
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.id = 'sw-career-detail-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);transition:all 0.3s ease';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:550px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:Roboto,sans-serif;max-height:90vh;overflow-y:auto;animation:swFadeIn .25s ease-out" class="no-scrollbar">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <h3 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:600;margin:0;color:#1a1a1a">Job Applicant Profile</h3>
        <button id="sw-career-modal-close" style="background:none;border:none;cursor:pointer;color:#888;font-size:24px;line-height:1;padding:0">&times;</button>
      </div>
      
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f1f1">
        <span style="font-size:20px;font-weight:700;color:#111">${name}</span>
        <span style="font-size:15px;color:#BE2229;font-weight:600">${position}</span>
        <span style="font-size:13px;color:#888">Submitted on ${date}</span>
      </div>

      <div style="margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Email Address</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500;word-break:break-all">${email}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Phone Number</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">${phone}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Experience Level</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500;text-transform:capitalize">${experience}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Current Location</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">${location}</p>
        </div>
      </div>

      <div style="margin-bottom:24px;background:#f9f9f9;border:1px solid #e9e9e9;border-radius:8px;padding:16px">
        <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600;display:block;margin-bottom:8px">Cover Letter / Message</span>
        <p style="font-size:14px;color:#2b2b2b;margin:0;line-height:1.6;white-space:pre-wrap;font-family:Roboto,sans-serif">${coverLetter}</p>
      </div>

      <div style="margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:12px">
          <svg style="color:#16a34a;width:24px;height:24px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span style="font-size:14px;font-weight:600;color:#14532d">Resume Attachment</span>
        </div>
        <div style="display:flex;gap:10px">
          <a href="${resumeUrl}" target="_blank" style="padding:6px 14px;border:1px solid #16a34a;border-radius:6px;color:#16a34a;text-decoration:none;font-size:13px;font-weight:600;background:#fff">View</a>
          <button onclick="downloadResume('${resumeUrl}', '${name.replace(/'/g, '').replace(/ /g, '_')}_resume')" style="padding:6px 14px;border:none;border-radius:6px;color:#fff;background:#16a34a;cursor:pointer;font-size:13px;font-weight:600">Download</button>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px">
        <button id="sw-career-modal-ok" style="padding:10px 24px;border:none;border-radius:7px;background:#BE2229;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('sw-career-modal-close').onclick = () => overlay.remove();
  document.getElementById('sw-career-modal-ok').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

/**
 * Dynamic pagination renderer
 */
let paginationTotalItems = 0;
let paginationCurrentPage = 1;

function renderPagination(totalItems = null, currentPage = null, perPage = recordsPerPage) {
  if (totalItems !== null) paginationTotalItems = totalItems;
  if (currentPage !== null) paginationCurrentPage = currentPage;

  const pag = document.getElementById('inquiries-pagination');
  if (!pag) return;

  if (paginationTotalItems === 0) {
    pag.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(paginationTotalItems / perPage) || 1;
  const startRecord = (paginationCurrentPage - 1) * perPage + 1;
  const endRecord = Math.min(paginationCurrentPage * perPage, paginationTotalItems);

  let buttonsHTML = '';
  
  // Previous button
  const prevDisabled = paginationCurrentPage === 1;
  buttonsHTML += `
    <button
      onclick="${prevDisabled ? '' : `changePage(${paginationCurrentPage - 1})`}"
      class="w-8 h-8 rounded border border-[#E9E9E9] flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm ${prevDisabled ? 'opacity-40 cursor-not-allowed' : ''}"
      ${prevDisabled ? 'disabled' : ''}
    >
      &lt;
    </button>
  `;

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === paginationCurrentPage;
    buttonsHTML += `
      <button
        onclick="changePage(${i})"
        class="w-8 h-8 rounded flex items-center justify-center font-medium shadow-sm transition ${
          isActive 
            ? 'bg-[#BE2229] text-white' 
            : 'border border-[#E9E9E9] text-black hover:bg-gray-50'
        }"
      >
        ${i}
      </button>
    `;
  }

  // Next button
  const nextDisabled = paginationCurrentPage === totalPages;
  buttonsHTML += `
    <button
      onclick="${nextDisabled ? '' : `changePage(${paginationCurrentPage + 1})`}"
      class="w-8 h-8 rounded border border-[#E9E9E9] flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm ${nextDisabled ? 'opacity-40 cursor-not-allowed' : ''}"
      ${nextDisabled ? 'disabled' : ''}
    >
      &gt;
    </button>
  `;

  pag.innerHTML = `
    <div class="flex items-center gap-2">
      ${buttonsHTML}
    </div>
    <span class="font-['Roboto'] font-medium text-[15px] leading-[18px] text-[#726565] ml-4">
      ${startRecord}–${endRecord} of ${paginationTotalItems}
    </span>
  `;
}

/**
 * Page change trigger
 */
window.changePage = function(newPage) {
  if (currentTab === 'messages') {
    fetchInquiries(newPage);
  } else if (currentTab === 'newsletter') {
    fetchNewsletter(newPage);
  } else if (currentTab === 'careers') {
    fetchCareers(newPage);
  } else if (currentTab === 'partners') {
    fetchPartners(newPage);
  } else if (currentTab === 'comingSoon') {
    fetchComingSoonNotifications(newPage);
  }
};

async function fetchComingSoonNotifications(page = 1) {
  comingSoonPage = page;
  const tbody = document.getElementById('coming-soon-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <div class="p-8 text-center text-[#656565] font-medium">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE2229] mb-2"></div>
      <div>Loading coming soon notifications...</div>
    </div>
  `;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/coming-soon?page=${page}&limit=${recordsPerPage}&search=${encodeURIComponent(comingSoonSearch)}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (!data.notifications || data.notifications.length === 0) {
        tbody.innerHTML = `<div class="p-8 text-center text-[#656565] font-medium">No coming soon notifications found.</div>`;
        if (currentTab === 'comingSoon') {
          renderPagination(0, page, recordsPerPage);
        }
        return;
      }

      tbody.innerHTML = '';
      data.notifications.forEach(item => {
        const isNew = item.status === 'New';
        const rowBg = isNew ? 'bg-red-50/30' : 'bg-white';
        const badge = isNew ? `<span class="bg-[#BE2229] text-white text-[10px] px-2 py-0.5 rounded-full font-['Inter']">NEW</span>` : '';
        const statusBadge = isNew
          ? `<span class="bg-red-100 text-[#BE2229] font-medium text-[12px] px-3 py-1 rounded-full">New</span>`
          : `<span class="bg-green-100 text-green-700 font-medium text-[12px] px-3 py-1 rounded-full">Viewed</span>`;
        const formatted = formatDate(item.createdAt);
        const detailDate = formatDetailedDate(item.createdAt);
        const escEmail = (item.email || '').replace(/'/g, "\\'");
        const escSource = (item.sourcePage || '').replace(/'/g, "\\'");

        const row = document.createElement('div');
        row.id = `coming-soon-row-${item._id}`;
        row.className = `flex flex-col lg:grid lg:grid-cols-[150px_minmax(0,1fr)_180px_140px_100px] gap-2 lg:gap-4 lg:items-center p-4 lg:px-[28px] lg:py-4 border-b border-gray-100 ${rowBg} lg:hover:bg-gray-50 transition relative`;
        row.innerHTML = `
          <span class="text-[#656565] text-[13px] lg:text-[15px] order-1 lg:order-none">${formatted}</span>
          <span class="text-black font-medium text-[16px] order-2 lg:order-none min-w-0 break-all flex items-center gap-2">${item.email} ${badge}</span>
          <span class="text-[#656565] text-[14px] lg:text-[15px] order-3 lg:order-none min-w-0 admin-cell-ellipsis" title="${item.sourcePage || ''}">${item.sourcePage || 'coming-soon.html'}</span>
          <div class="flex lg:justify-center order-4 lg:order-none mt-1 lg:mt-0">${statusBadge}</div>
          <div class="absolute right-4 top-4 lg:relative lg:right-auto lg:top-auto flex items-center justify-end lg:justify-center gap-3 order-5 lg:order-none">
            <button
              onclick="viewComingSoonNotification('${item._id}', '${escEmail}', '${escSource}', '${detailDate}', ${isNew})"
              class="text-[#BE2229] hover:underline text-[14px] font-medium bg-red-50 lg:bg-transparent px-3 py-1 lg:px-0 lg:py-0 rounded"
            >
              View
            </button>
          </div>
        `;
        tbody.appendChild(row);
      });

      if (currentTab === 'comingSoon') {
        renderPagination(data.total, page, recordsPerPage);
      }
    } else {
      tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Failed to retrieve coming soon notifications.</div>`;
    }
  } catch (err) {
    console.error('[Fetch Coming Soon Notifications Error]', err);
    tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Server connection error.</div>`;
  }
}

window.viewComingSoonNotification = async function(id, email, sourcePage, date, isNew) {
  if (isNew) {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/coming-soon/${id}/viewed`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const row = document.getElementById(`coming-soon-row-${id}`);
        if (row) {
          row.classList.remove('bg-red-50/30');
          row.classList.add('bg-white');
          const newBadge = row.querySelector("span.bg-\\[\\#BE2229\\]");
          if (newBadge) newBadge.remove();
        }
        fetchStats();
        if (currentTab === 'comingSoon') {
          fetchComingSoonNotifications(comingSoonPage);
        }
      }
    } catch (err) {
      console.error('[Mark Coming Soon Viewed Error]', err);
    }
  }

  openMessageModal('Coming Soon Notification', email, 'N/A', sourcePage || 'coming-soon.html', date, `Email: ${email}\nSource Page: ${sourcePage || 'coming-soon.html'}\nStatus: Viewed`);
};

/**
 * Handle "View" click: patch status to Read, update stats, show modal
 */
window.viewInquiryDetail = async function(id, name, email, phone, subject, date, message, isNew) {
  // If status is Unread, send patch read API request
  if (isNew) {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Remove reddish bg
        const row = document.getElementById(`inq-row-${id}`);
        if (row) {
          row.classList.remove('bg-red-50/30');
          row.classList.add('bg-white');
          // Remove badge
          const badgeEl = row.querySelector("span.bg-\\[\\#BE2229\\]");
          if (badgeEl) badgeEl.remove();
        }
        
        // Fetch new stats (decrements unread counter)
        fetchStats();
      }
    } catch (err) {
      console.error('[Patch Read Error]', err);
    }
  }

  // Open modal with inquiry content
  openMessageModal(name, email, phone, subject, date, message);
};

/**
 * Delete newsletter subscriber from backend
 */
window.removeSubscriber = async function(id, email) {
  const confirmed = await showConfirm({
    title: 'Remove Subscriber',
    message: `Are you sure you want to remove the subscriber '${email}'?\n\nThis action cannot be undone.`,
    confirmText: 'Yes, Remove',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/newsletter/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showModal({ type: 'success', title: 'Subscriber Removed', message: data.message || 'Subscriber removed successfully.', buttonText: 'Okay' });
      fetchStats();
      fetchNewsletter(newsletterPage);
    } else {
      showModal({ type: 'error', title: 'Removal Failed', message: data.message || 'Failed to remove subscriber.', buttonText: 'Okay' });
    }
  } catch (err) {
    console.error('[Delete Subscriber Error]', err);
    showModal({ type: 'error', title: 'Server Error', message: 'A server error occurred while removing the subscriber.', buttonText: 'Okay' });
  }
};

/**
 * Modal toggling animations
 */
const msgModal = document.getElementById("view-message-modal");
const msgModalContainer = document.getElementById("message-modal-container");

window.openMessageModal = function(name, email, phone, subject, date, message) {
  document.getElementById("modal-msg-name").innerText = name;
  document.getElementById("modal-msg-email").innerText = email;
  const normalizedPhone = phone && phone !== 'N/A' ? `+91 ${phone.replace(/^\+91\s?/, '')}` : 'N/A';
  document.getElementById("modal-msg-phone").innerText = normalizedPhone;
  document.getElementById("modal-msg-subject").innerText = subject;
  document.getElementById("modal-msg-date").innerText = date;
  document.getElementById("modal-msg-body").innerText = message;

  msgModal.classList.remove("hidden");
  msgModal.classList.add("flex");

  // Trigger animation
  setTimeout(() => {
    msgModal.classList.remove("opacity-0");
    msgModalContainer.classList.remove("scale-95", "opacity-0");
  }, 10);
};

window.closeMessageModal = function() {
  msgModal.classList.add("opacity-0");
  msgModalContainer.classList.add("scale-95", "opacity-0");

  setTimeout(() => {
    msgModal.classList.add("hidden");
    msgModal.classList.remove("flex");
  }, 300); // match transition duration
};

// Close on overlay click
msgModal.addEventListener("click", function(e) {
  if (e.target === msgModal) {
    closeMessageModal();
  }
});

/**
 * Unified Header Search Listener (Filters messages or newsletter tab)
 */
const searchInput = document.getElementById("desktop-search-input");
if (searchInput) {
  let debounceTimer;
  searchInput.addEventListener('input', function(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const val = e.target.value.trim();
      if (currentTab === 'messages') {
        messagesSearch = val;
        fetchInquiries(1);
      } else if (currentTab === 'newsletter') {
        newsletterSearch = val;
        fetchNewsletter(1);
      } else if (currentTab === 'careers') {
        careersSearch = val;
        fetchCareers(1);
      } else if (currentTab === 'partners') {
        partnersSearch = val;
        fetchPartners(1);
      } else if (currentTab === 'comingSoon') {
        comingSoonSearch = val;
        fetchComingSoonNotifications(1);
      }
    }, 400); // 400ms debounce
  });
}

// Bind Careers Filters
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'career-filter-status') {
    fetchCareers(1);
  }
  if (e.target && e.target.id === 'career-filter-position') {
    fetchCareers(1);
  }
  if (e.target && e.target.id === 'career-filter-experience') {
    fetchCareers(1);
  }
  
  // Bind Partners Filters
  if (e.target && e.target.id === 'partner-filter-status') {
    fetchPartners(1);
  }
  if (e.target && e.target.id === 'partner-filter-category') {
    fetchPartners(1);
  }
});

/**
 * CSV / XLSX Dynamic Client-Side Export
 */
window.downloadInquiriesExport = async function(format) {
  try {
    showToast(`Preparing ${format.toUpperCase()} export…`, 'info');

    let endpoint = '';
    let filenamePrefix = '';
    let headers = [];
    let mapRowFn = null;

    if (currentTab === 'messages') {
      endpoint = `${CONFIG.API_BASE_URL}/inquiries?page=1&limit=2000`;
      filenamePrefix = 'springwala_inquiries';
      headers = ['Date', 'Full Name', 'Email', 'Phone', 'Subject', 'Message', 'Status'];
      mapRowFn = (inq) => [
        formatDate(inq.createdAt),
        inq.fullName,
        inq.email,
        `+91 ${inq.phoneNumber}`,
        inq.subject,
        inq.message,
        inq.status
      ];
    } else if (currentTab === 'newsletter') {
      endpoint = `${CONFIG.API_BASE_URL}/inquiries/newsletter?page=1&limit=2000`;
      filenamePrefix = 'springwala_newsletter';
      headers = ['Date Subscribed', 'Email', 'Status'];
      mapRowFn = (sub) => [
        formatDate(sub.subscribedAt || sub.createdAt),
        sub.email,
        sub.status
      ];
    } else if (currentTab === 'careers') {
      endpoint = `${CONFIG.API_BASE_URL}/careers?page=1&limit=2000`;
      filenamePrefix = 'springwala_careers';
      headers = ['Date', 'Full Name', 'Email', 'Phone', 'Position', 'Experience', 'Location', 'Status', 'Resume URL'];
      mapRowFn = (app) => [
        formatDate(app.createdAt),
        app.fullName,
        app.email,
        app.phone,
        app.position,
        app.experience,
        app.location,
        app.status,
        `${CONFIG.IMAGE_BASE_URL.replace(/\/$/, '')}/${app.resumeUrl}`
      ];
    } else if (currentTab === 'partners') {
      endpoint = `${CONFIG.API_BASE_URL}/admin/partners?page=1&limit=2000`;
      filenamePrefix = 'springwala_partners';
      headers = ['Date', 'Full Name', 'Email', 'Phone', 'Business Name', 'GST Number', 'Product Category', 'Status'];
      mapRowFn = (part) => [
        formatDate(part.createdAt),
        part.fullName,
        part.email,
        part.phone,
        part.businessName,
        part.gstNumber || 'N/A',
        part.productCategory,
        part.status
      ];
    } else if (currentTab === 'comingSoon') {
      endpoint = `${CONFIG.API_BASE_URL}/inquiries/coming-soon?page=1&limit=2000`;
      filenamePrefix = 'springwala_coming_soon_notifications';
      headers = ['Date', 'Email', 'Source Page', 'Status'];
      mapRowFn = (item) => [
        formatDate(item.createdAt),
        item.email,
        item.sourcePage,
        item.status
      ];
    }

    if (!endpoint) return;

    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();

    let items = [];
    if (currentTab === 'messages')    items = data.inquiries    || [];
    else if (currentTab === 'newsletter') items = data.subscribers || [];
    else if (currentTab === 'careers')    items = data.applications || [];
    else if (currentTab === 'partners')   items = data.applications || [];
    else if (currentTab === 'comingSoon') items = data.notifications || [];

    if (!res.ok || !data.success || items.length === 0) {
      showToast('No records found to export.', 'warning');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename  = `${filenamePrefix}_${timestamp}.${format}`;

    if (format === 'xlsx') {
      // ── Real XLSX via SheetJS ──────────────────────────────────────────
      const sheetData = items.map(item => {
        const row = mapRowFn(item);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData, { header: headers });
      const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, filename);

    } else {
      // ── Proper UTF-8 CSV with BOM ──────────────────────────────────────
      const esc = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };
      let csv = '\uFEFF'; // BOM for Excel compatibility
      csv += headers.join(',') + '\r\n';
      items.forEach(item => {
        csv += mapRowFn(item).map(esc).join(',') + '\r\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    showToast(`${items.length} records exported as ${filename}`, 'success');

  } catch (err) {
    console.error('[Export Error]', err);
    showToast('Export failed. Please try again.', 'error');
  }
};

async function fetchPartners(page = 1) {
  partnersPage = page;
  const tbody = document.getElementById('partners-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <div class="p-8 text-center text-[#656565] font-medium">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BE2229] mb-2"></div>
      <div>Loading partner applications...</div>
    </div>
  `;

  try {
    const statusVal = document.getElementById('partner-filter-status')?.value || '';
    const categoryVal = document.getElementById('partner-filter-category')?.value || '';

    const queryParams = new URLSearchParams({
      page,
      limit: recordsPerPage,
      search: partnersSearch,
      status: statusVal,
      productCategory: categoryVal
    });

    const res = await fetch(`${CONFIG.API_BASE_URL}/admin/partners?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (!data.applications || data.applications.length === 0) {
        tbody.innerHTML = `<div class="p-8 text-center text-[#656565] font-medium">No applications found matching your criteria.</div>`;
        if (currentTab === 'partners') {
          renderPagination(0, page, recordsPerPage);
        }
        return;
      }

      tbody.innerHTML = '';
      data.applications.forEach(part => {
        const formattedDate = formatDate(part.createdAt);
        
        // Status dropdown options
        const statuses = ['New', 'Contacted', 'Under Review', 'Approved', 'Rejected'];
        const statusOptions = statuses.map(s => `
          <option value="${s}" ${part.status === s ? 'selected' : ''}>${s}</option>
        `).join('');

        const escName = part.fullName.replace(/'/g, "\\'");
        const escEmail = part.email.replace(/'/g, "\\'");
        const escPhone = part.phone.replace(/'/g, "\\'");
        const escBusiness = part.businessName.replace(/'/g, "\\'");
        const escGst = (part.gstNumber || '').replace(/'/g, "\\'");
        const escCat = part.productCategory.replace(/'/g, "\\'");
        const escStatus = part.status.replace(/'/g, "\\'");

        const row = document.createElement('div');
        row.className = `flex flex-col xl:grid xl:grid-cols-[110px_160px_180px_120px_160px_120px_160px_140px_80px] gap-2 xl:items-center p-4 xl:px-[28px] xl:py-4 border-b border-gray-100 bg-white hover:bg-gray-50 transition relative font-['Roboto']`;
        row.innerHTML = `
          <span class="text-[#656565] text-[13px] xl:text-[15px] order-1 xl:order-none">${formattedDate}</span>
          <span class="text-black font-semibold text-[16px] order-2 xl:order-none truncate">${part.fullName}</span>
          <span class="text-[#656565] text-[14px] xl:text-[15px] order-3 xl:order-none truncate break-all">${part.email}</span>
          <span class="text-[#656565] text-[14px] xl:text-[15px] order-4 xl:order-none">+91 ${part.phone}</span>
          <span class="text-black font-medium text-[14px] xl:text-[15px] order-5 xl:order-none truncate">${part.businessName}</span>
          <span class="text-[#656565] text-[14px] xl:text-[15px] order-6 xl:order-none">${part.gstNumber || 'N/A'}</span>
          <span class="text-[#656565] text-[14px] xl:text-[15px] order-7 xl:order-none capitalize">${part.productCategory.replace(/-/g, ' ')}</span>
          
          <div class="flex items-center justify-start xl:justify-center order-8 xl:order-none">
            <select 
              onchange="updatePartnerStatus('${part._id}', this.value)"
              class="border rounded px-2 py-1 text-[13px] bg-white outline-none cursor-pointer font-medium w-full"
              style="color: ${getPartnerStatusColor(part.status)}; border-color: ${getPartnerStatusColor(part.status)}88"
            >
              ${statusOptions}
            </select>
          </div>

          <div class="absolute right-4 top-4 xl:relative xl:right-auto xl:top-auto flex items-center justify-end xl:justify-center gap-3 order-9 xl:order-none font-medium">
            <button
              onclick="viewPartnerDetail('${part._id}', '${escName}', '${escEmail}', '${escPhone}', '${escBusiness}', '${escGst}', '${escCat}', '${formattedDate}', '${escStatus}')"
              class="text-[#BE2229] hover:underline text-[14px] font-bold bg-red-50 xl:bg-transparent px-3 py-1 xl:px-0 xl:py-0 rounded"
            >
              View
            </button>
          </div>
        `;
        tbody.appendChild(row);
      });

      if (currentTab === 'partners') {
        renderPagination(data.total, page, recordsPerPage);
      }
    } else {
      tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Failed to retrieve partner applications.</div>`;
    }
  } catch (err) {
    console.error('[Fetch Partners Error]', err);
    tbody.innerHTML = `<div class="p-8 text-center text-[#BE2229] font-medium">Server connection error.</div>`;
  }
}

function getPartnerStatusColor(status) {
  const map = {
    'New': '#2563eb',
    'Contacted': '#0284c7',
    'Under Review': '#d97706',
    'Approved': '#16a34a',
    'Rejected': '#BE2229'
  };
  return map[status] || '#718096';
}

window.updatePartnerStatus = async function(id, status) {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/admin/partners/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Partner status updated successfully!', 'success');
      fetchStats();
      fetchPartners(partnersPage);
    } else {
      showToast(data.message || 'Failed to update status.', 'error');
    }
  } catch (err) {
    console.error('[Update Partner Status Error]', err);
    showToast('Server error updating status.', 'error');
  }
};

window.viewPartnerDetail = function(id, name, email, phone, businessName, gstNumber, productCategory, date, status) {
  // Remove existing modal if any
  document.getElementById('sw-partner-detail-modal')?.remove();

  if (!document.getElementById('sw-partner-modal-style')) {
    const s = document.createElement('style');
    s.id = 'sw-partner-modal-style';
    s.textContent = `
      @keyframes swFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
    `;
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.id = 'sw-partner-detail-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);transition:all 0.3s ease';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:550px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:Roboto,sans-serif;max-height:90vh;overflow-y:auto;animation:swFadeIn .25s ease-out" class="no-scrollbar">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <h3 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:600;margin:0;color:#1a1a1a">Partner Application Profile</h3>
        <button id="sw-partner-modal-close" style="background:none;border:none;cursor:pointer;color:#888;font-size:24px;line-height:1;padding:0">&times;</button>
      </div>
      
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f1f1">
        <span style="font-size:20px;font-weight:700;color:#111">${name}</span>
        <span style="font-size:15px;color:#BE2229;font-weight:600">${businessName}</span>
        <span style="font-size:13px;color:#888">Submitted on ${date}</span>
      </div>

      <div style="margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Email Address</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500;word-break:break-all">${email}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Phone Number</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">+91 ${phone}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">GST Number</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500">${gstNumber || 'N/A'}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Product Category</span>
          <p style="font-size:15px;color:#1a1a1a;margin:4px 0 0;font-weight:500;text-transform:capitalize">${productCategory.replace(/-/g, ' ')}</p>
        </div>
        <div>
          <span style="font-size:12px;color:#888;text-transform:uppercase;font-weight:600">Current Status</span>
          <p style="font-size:15px;margin:4px 0 0;font-weight:600;color:${getPartnerStatusColor(status)}">${status}</p>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px">
        <button id="sw-partner-modal-ok" style="padding:10px 24px;border:none;border-radius:7px;background:#BE2229;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('sw-partner-modal-close').onclick = () => overlay.remove();
  document.getElementById('sw-partner-modal-ok').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// Initialize
fetchStats();
fetchInquiries(1);

// Auto-open inquiry detail if id param exists
const urlParams = new URLSearchParams(window.location.search);
const autoInquiryId = urlParams.get('id');
if (autoInquiryId) {
  openInquiryById(autoInquiryId.trim());
}

async function openInquiryById(id) {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/${id}`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const inq = data.inquiry;
      const isNew = inq.status === 'Unread';
      
      const escName = inq.fullName.replace(/'/g, "\\'");
      const escEmail = inq.email.replace(/'/g, "\\'");
      const escPhone = inq.phoneNumber.replace(/'/g, "\\'");
      const escSubject = inq.subject.replace(/'/g, "\\'");
      const escMsg = inq.message.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
      
      // Auto-populate filter search to highlight row
      messagesSearch = inq.fullName;
      const searchInput = document.getElementById("desktop-search-input");
      if (searchInput) searchInput.value = inq.fullName;
      
      await fetchInquiries(1);
      
      viewInquiryDetail(inq._id, escName, escEmail, escPhone, escSubject, formatDetailedDate(inq.createdAt), escMsg, isNew);
    }
  } catch (err) {
    console.error('[Open Inquiry By ID Error]', err);
  }
}
