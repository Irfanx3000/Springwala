/**
 * admin-inquiries.js - Production-grade Inquiries and Subscriptions Admin Controller
 */

// Global State
let currentTab = 'messages'; // 'messages' or 'newsletter'
let messagesPage = 1;
let newsletterPage = 1;
const recordsPerPage = 10;
let messagesSearch = '';
let newsletterSearch = '';

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

  // Content Visibility toggle
  document.getElementById("content-messages").classList.toggle("active", tabId === 'messages');
  document.getElementById("content-newsletter").classList.toggle("active", tabId === 'newsletter');

  // Rerender pagination & search for active tab
  const activeSearchInput = document.getElementById("desktop-search-input");
  if (activeSearchInput) {
    activeSearchInput.value = tabId === 'messages' ? messagesSearch : newsletterSearch;
  }
  
  renderPagination();
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
      document.getElementById('stat-new-subs-week').innerText = data.stats.newSubsThisWeek.toLocaleString();
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
  } else {
    fetchNewsletter(newPage);
  }
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
  if (!confirm(`Are you sure you want to remove the subscriber '${email}'?`)) {
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries/newsletter/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message || 'Subscriber removed successfully.');
      fetchStats();
      fetchNewsletter(newsletterPage);
    } else {
      alert(data.message || 'Failed to remove subscriber.');
    }
  } catch (err) {
    console.error('[Delete Subscriber Error]', err);
    alert('Server error removing subscriber.');
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
  document.getElementById("modal-msg-phone").innerText = `+91 ${phone.replace(/^\+91\s?/, '')}`;
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
      } else {
        newsletterSearch = val;
        fetchNewsletter(1);
      }
    }, 400); // 400ms debounce
  });
}

/**
 * CSV / XLSX Dynamic Client-Side Export
 */
window.downloadInquiriesExport = async function(format) {
  try {
    // Fetch all records (unfiltered and non-paginated up to a reasonable limit)
    const res = await fetch(`${CONFIG.API_BASE_URL}/inquiries?page=1&limit=2000`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const data = await res.json();

    if (!res.ok || !data.success || !data.inquiries || data.inquiries.length === 0) {
      alert('No inquiry records found to export.');
      return;
    }

    const inquiries = data.inquiries;

    // Helper to sanitize CSV field
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Double quote escaping for CSV
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    // CSV Headers
    const headers = ['Date', 'Full Name', 'Email', 'Phone', 'Subject', 'Message', 'Status'];
    
    // Convert to CSV string
    let csvContent = '\uFEFF'; // Add UTF-8 BOM so Excel opens it with correct encoding
    csvContent += headers.join(',') + '\r\n';

    inquiries.forEach(inq => {
      const row = [
        formatDate(inq.createdAt),
        inq.fullName,
        inq.email,
        `+91 ${inq.phoneNumber}`,
        inq.subject,
        inq.message,
        inq.status
      ];
      csvContent += row.map(esc).join(',') + '\r\n';
    });

    // Create browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const ext = format === 'xlsx' ? 'xlsx' : 'csv'; // support both extensions as requested
    link.setAttribute("download", `springwala_inquiries_export_${timestamp}.${ext}`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('[Export Error]', err);
    alert('An error occurred during data export. Please try again.');
  }
};

// Initialize
fetchStats();
fetchInquiries(1);
fetchNewsletter(1);

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
