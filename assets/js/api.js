/**
 * Springwala Admin — api.js
 * Shared utility: auth, fetch, toast, confirm, helpers
 * Include on EVERY admin page BEFORE page scripts.
 */

var API_BASE = CONFIG.API_BASE_URL;
var BASE_URL = CONFIG.IMAGE_BASE_URL;

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Auth is now handled by auth.js. 
// Ensure auth.js is loaded BEFORE api.js.

// ─── Core Fetch ───────────────────────────────────────────────────────────────
async function apiFetch(endpoint, opts = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...opts.headers };
  const token = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (e) {
    console.error(`[API-ERROR] Fetch failed for ${url}:`, e);
    // Don't throw for simple network failures, just return null or rethrow
    throw new Error('Network error. Please check your connection.');
  }

  // 401 Handling: Trigger silent validation
  if (res.status === 401) {
    console.warn(`[API-WARN] 401 Unauthorized at ${endpoint}`);
    if (typeof Auth !== 'undefined') Auth.validate(); // This will logout if truly expired
    return null;
  }

  let data;
  try { 
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      // If not JSON, use the raw text or a default message
      throw new Error(text || `Server error ${res.status}`);
    }
  } catch (e) { 
    throw new Error(e.message || 'Invalid server response'); 
  }
  
  if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);
  return data;
}

const api = {
  get: (url, params) => apiFetch(url + (params && Object.keys(params).length ? '?' + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  ) : '')),
  post: (url, body) => apiFetch(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (url, body) => apiFetch(url, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  download: async (url, filename) => {
    const fullUrl = `${API_BASE}${url}`;
    console.log(`[API-DEBUG] Downloading: ${fullUrl}`);
    const token = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
    const res = await fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  document.getElementById('sw-toast')?.remove();
  const colors = { success: '#16a34a', error: '#BE2229', warning: '#d97706', info: '#2563eb' };
  const icons = { success: 'M5 13l4 4L19 7', error: 'M6 18L18 6M6 6l12 12', warning: 'M12 9v2m0 4h.01', info: 'M13 16h-1v-4h-1m1-4h.01' };
  const t = document.createElement('div');
  t.id = 'sw-toast';
  t.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;background:${colors[type]};color:#fff;padding:12px 18px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;font-family:Roboto,sans-serif;font-size:14px;font-weight:500;max-width:360px;animation:swSlideIn .25s ease`;
  t.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${icons[type]}"/></svg><span>${msg}</span>`;
  if (!document.getElementById('sw-toast-style')) {
    const s = document.createElement('style');
    s.id = 'sw-toast-style';
    s.textContent = '@keyframes swSlideIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function showConfirm(message, onConfirm) {
  document.getElementById('sw-confirm')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'sw-confirm';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <h3 style="font-family:Poppins,sans-serif;font-size:17px;font-weight:600;margin:0 0 10px;color:#1a1a1a">Confirm Action</h3>
      <p style="font-family:Roboto,sans-serif;font-size:14px;color:#555;margin:0 0 24px;line-height:1.5">${message}</p>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button id="sw-confirm-no" style="padding:9px 20px;border:1px solid #ddd;border-radius:7px;background:#fff;cursor:pointer;font-size:14px;font-family:Roboto,sans-serif">Cancel</button>
        <button id="sw-confirm-yes" style="padding:9px 20px;border:none;border-radius:7px;background:#BE2229;color:#fff;cursor:pointer;font-size:14px;font-weight:600;font-family:Roboto,sans-serif">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('sw-confirm-yes').onclick = () => { overlay.remove(); onConfirm?.(); };
  document.getElementById('sw-confirm-no').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = (val ?? '—'); }

function formatCurrency(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

function formatDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'Just now'; if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function imageUrl(path) {
  if (!path) return '../assets/images/deafult.png';
  if (path.startsWith('http')) return path;
  if (path.startsWith('data:')) return path;

  // 1. Normalize the path (ensure no leading slash for logic)
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // 2. Intelligence: If the path does NOT start with 'uploads/' or 'assets/', 
  // and doesn't look like a direct root file, assume it's an upload
  if (!cleanPath.startsWith('uploads/') && !cleanPath.startsWith('assets/')) {
    cleanPath = 'uploads/' + cleanPath;
  }

  // 3. Construct full URL using BASE_URL (ensuring no trailing slash on base)
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${cleanBase}/${cleanPath}`;
}

function orderStatusBadge(s) {
  const map = { Pending: '#fbbf24|#78350f', Ordered: '#60a5fa|#1e3a5f', Processing: '#a78bfa|#4c1d95', Shipped: '#fb923c|#7c2d12', Delivered: '#4ade80|#14532d', Cancelled: '#f87171|#7f1d1d', Returned: '#94a3b8|#1e293b' };
  const [bg, color] = (map[s] || '#e5e7eb|#374151').split('|');
  return `<span style="background:${bg}22;color:${color};padding:3px 12px;border-radius:100px;font-size:13px;font-weight:500;white-space:nowrap">${s}</span>`;
}

function paymentStatusBadge(s) {
  const map = { Completed: '#4ade80|#14532d', Pending: '#fbbf24|#78350f', Failed: '#f87171|#7f1d1d', Refunded: '#94a3b8|#1e293b' };
  const [bg, color] = (map[s] || '#e5e7eb|#374151').split('|');
  return `<span style="background:${bg}22;color:${color};padding:3px 12px;border-radius:100px;font-size:13px;font-weight:500;white-space:nowrap">${s}</span>`;
}

function stockBadge(stock, threshold) {
  if (stock === 0) return `<span style="background:#fee2e2;color:#BE2229;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600">Out of Stock</span>`;
  if (stock <= threshold) return `<span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600">Low</span>`;
  return `<span style="background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:600">In Stock</span>`;
}

// Pagination renderer — calls onPage(n) on click
function buildPagination(containerId, currentPage, totalPages, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <button class="prev-page-btn w-[23px] h-[23px] bg-white border border-[#EEEEEE] rounded-[2px] flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shrink-0" ${currentPage <= 1 ? 'disabled' : ''}>
      <svg class="w-3 h-3 text-[#BDBDBD]" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
    </button>
    <span class="font-['Roboto'] font-medium text-[14px] text-[#726565] text-center shrink-0">${currentPage} / ${totalPages}</span>
    <button class="next-page-btn w-[23px] h-[23px] bg-white border border-[#E6E6E6] rounded-[2px] flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shrink-0" ${currentPage >= totalPages ? 'disabled' : ''}>
      <svg class="w-3 h-3 text-[#2B2B2B]" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
    </button>`;

  el.querySelector('.prev-page-btn').onclick = () => onPage(currentPage - 1);
  el.querySelector('.next-page-btn').onclick = () => onPage(currentPage + 1);
}

// ─── Global Search ─────────────────────────────────────────────────────────────
function resolveAdminPath(target) {
  const path = window.location.pathname;
  const depth = (path.match(/\//g) || []).length;
  // If we are at root (depth 1 or 0), just return target
  // If we are at depth 2 (e.g. /products/add-product.html), we need "../"
  if (depth <= 1) return target;
  let prefix = '';
  for (let i = 0; i < depth - 1; i++) prefix += '../';
  return prefix + target;
}

function initGlobalSearch() {
  let desktopSearch = document.getElementById('desktop-search-input');
  let mobileSearch = document.getElementById('mobile-search-input');

  // Fallback: search by placeholder if ID is missing
  if (!desktopSearch || !mobileSearch) {
    const allInputs = document.querySelectorAll('input[placeholder]');
    allInputs.forEach(input => {
      const p = input.getAttribute('placeholder').toLowerCase();
      if (p.includes('search orders') || p.includes('search, products')) {
        // Correctly identify based on container visibility classes instead of just window width
        const isDesktopContainer = input.closest('.hidden.sm\\:flex');
        const isMobileContainer = input.closest('.md\\:hidden');

        if (isDesktopContainer && !desktopSearch) {
          desktopSearch = input;
          if (!input.id) input.id = 'desktop-search-input';
        } else if (isMobileContainer && !mobileSearch) {
          mobileSearch = input;
          if (!input.id) input.id = 'mobile-search-input';
        } else if (!input.id) {
            // Last resort fallback
            input.id = 'search-input-' + Math.random().toString(36).substr(2, 5);
        }
      }
    });
  }

  if (!desktopSearch && !mobileSearch) return;

  // Create results container
  const resultsDiv = document.createElement('div');
  resultsDiv.id = 'sw-search-results';
  resultsDiv.className = 'hidden fixed top-[75px] md:top-[120px] left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] max-h-[500px] bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-y-auto no-scrollbar pb-4';
  resultsDiv.style.animation = 'swFadeIn .2s ease';
  document.body.appendChild(resultsDiv);

  if (!document.getElementById('sw-search-style')) {
    const s = document.createElement('style');
    s.id = 'sw-search-style';
    s.textContent = `
      @keyframes swFadeIn{from{opacity:0;transform:translate(-50%, -10px)}to{opacity:1;transform:translate(-50%, 0)}}
      .search-section-title { font-family: Poppins, sans-serif; font-size: 13px; font-weight: 600; color: #BE2229; padding: 12px 16px 8px; border-bottom: 1px solid #eee; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
      .search-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; transition: background 0.2s; cursor: pointer; }
      .search-item:hover { background: #f9f9f9; }
      .search-item img { width: 40px; height: 40px; border-radius: 6px; object-fit: contain; background: #fdfdfd; border: 1px solid #f0f0f0; }
      .search-item .info { display: flex; flex-direction: column; overflow: hidden; }
      .search-item .name { font-weight: 500; font-size: 15px; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .search-item .meta { font-size: 12px; color: #666; }
      #sw-search-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.15); backdrop-filter:blur(2px); z-index:9998; }
    `;
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.id = 'sw-search-overlay';
  document.body.appendChild(overlay);

  let debounceTimer;
  const performSearch = async (query) => {
    if (query.length < 2) {
      resultsDiv.classList.add('hidden');
      overlay.style.display = 'none';
      return;
    }

    try {
      resultsDiv.innerHTML = `<div class="flex items-center justify-center py-10"><div class="animate-spin w-8 h-8 border-4 border-[#BE2229] border-t-transparent rounded-full"></div></div>`;
      resultsDiv.classList.remove('hidden');
      overlay.style.display = 'block';

      const data = await api.get('/search', { q: query });
      if (!data || !data.success) throw new Error('Search failed');

      const { products, orders, customers } = data.results;
      let html = '';

      if (products.length) {
        html += `<div class="search-section-title">Products</div>`;
        html += products.map(p => `
          <div class="search-item" onclick="window.location.href='${resolveAdminPath('products/add-product.html?id=' + p._id)}'">
            <img src="${imageUrl(p.images?.[0])}" alt="">
            <div class="info">
              <span class="name">${p.name}</span>
              <span class="meta">${p.sku || 'SKU N/A'} • ₹${p.price.toLocaleString()}</span>
            </div>
          </div>
        `).join('');
      }

      if (orders.length) {
        html += `<div class="search-section-title">Orders</div>`;
        html += orders.map(o => `
          <div class="search-item" onclick="window.location.href='${resolveAdminPath('orders.html?id=' + o._id)}'">
            <div class="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
               <svg class="w-5 h-5 text-[#BE2229]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            </div>
            <div class="info">
              <span class="name">#${o.orderID}</span>
              <span class="meta">${o.status} • ₹${o.totalPrice.toLocaleString()}</span>
            </div>
          </div>
        `).join('');
      }

      if (customers.length) {
        html += `<div class="search-section-title">Customers</div>`;
        html += customers.map(c => `
          <div class="search-item" onclick="window.location.href='${resolveAdminPath('users.html?id=' + c._id)}'">
            <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
               ${c.avatar ? `<img src="${imageUrl(c.avatar)}" class="w-full h-full object-cover">` : `<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>`}
            </div>
            <div class="info">
              <span class="name">${c.name}</span>
              <span class="meta">${c.email} • ${c.phone || ''}</span>
            </div>
          </div>
        `).join('');
      }

      if (!html) html = `<div class="py-12 text-center text-gray-500 font-['Roboto']">No results found for "${query}"</div>`;
      resultsDiv.innerHTML = html;

    } catch (err) {
      resultsDiv.innerHTML = `<div class="py-8 px-4 text-center text-red-500 font-['Roboto'] text-[14px]">Error: ${err.message}</div>`;
    }
  };

  const handleInput = (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(e.target.value.trim()), 300);
  };

  desktopSearch?.addEventListener('input', handleInput);
  mobileSearch?.addEventListener('input', handleInput);

  overlay.onclick = () => { resultsDiv.classList.add('hidden'); overlay.style.display = 'none'; };
}

// Auto-init common features
document.addEventListener('DOMContentLoaded', () => {
  // UI features like sidebar are now handled by admin-sidebar.js
  initGlobalSearch();
});
