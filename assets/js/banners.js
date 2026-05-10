/**
 * banners.js
 * Works for ALL banner pages: homepage, category, promotional,
 * features, advertisement, section, informational
 *
 * Set banner type on <body data-banner-type="homepage">
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar(); initAdminHeader();

  const bannerType = document.body.dataset.bannerType || 'homepage';
  await loadBanners(bannerType);
  bindBannerEvents(bannerType);
});

let editBannerId = null;
let currentFilters = { search: '', isActive: '', sort: '' };

async function loadBanners(type) {
  const grid = document.getElementById('banners-grid');
  if (!grid) return;

  grid.innerHTML = Array(3).fill(`<div class="animate-pulse bg-gray-100 rounded-[12px] h-40 w-full mb-4"></div>`).join('');

  try {
    const params = { type, ...currentFilters };
    const data = await api.get('/banners/admin', params);
    if (!data) return;
    
    const countEl = document.getElementById('banners-count');
    if (countEl) countEl.textContent = data.count;

    if (!data.banners.length) {
      grid.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-[12px] border border-[#E9E9E9]">
        <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <p>No banners found match your filters.</p>
      </div>`;
      return;
    }

    grid.className = "flex flex-col gap-4 w-full"; // Ensure full width
    grid.innerHTML = data.banners.map(b => `
      <div class="bg-white rounded-[12px] border border-[#E9E9E9] p-4 flex flex-col lg:flex-row lg:items-center gap-5 shadow-sm hover:shadow-md transition relative group overflow-hidden">
        
        <!-- Previews Wrapper -->
        <div class="flex flex-row items-center gap-4 shrink-0 justify-center lg:justify-start">
            <!-- Desktop Preview -->
            <div class="flex flex-col items-center gap-1.5">
                <div class="w-[140px] sm:w-[180px] lg:w-[200px] h-[78px] sm:h-[101px] lg:h-[112px] bg-gray-100 rounded-[8px] border border-[#EFEFEF] overflow-hidden flex items-center justify-center">
                    <img src="${imageUrl(b.image)}" class="w-full h-full object-contain" alt="Desktop" onerror="this.src='../../assets/images/deafult.png'">
                </div>
                <span class="text-[10px] sm:text-[12px] text-gray-400 font-medium uppercase tracking-wider">Desktop</span>
            </div>
 
            <!-- Mobile Preview -->
            <div class="flex flex-col items-center gap-1.5">
                <div class="w-[56px] sm:w-[72px] lg:w-[80px] h-[78px] sm:h-[101px] lg:h-[112px] rounded border border-gray-100 overflow-hidden bg-gray-50 relative">
                  <div class="absolute top-1 left-1 bg-black/40 text-white text-[8px] px-1 rounded z-10">MOBILE</div>
                  ${b.mobileImage ? 
                    `<img src="${imageUrl(b.mobileImage)}" class="w-full h-full object-cover" alt="Mobile" onerror="this.src='../../assets/images/deafult.png'">` : 
                    `<div class="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-400 opacity-60">
                       <img src="${imageUrl(b.image)}" class="w-full h-full object-cover blur-[1px] grayscale opacity-30" alt="Mobile Fallback" onerror="this.src='../../assets/images/deafult.png'">
                       <span class="absolute inset-0 flex items-center justify-center font-bold text-[9px] bg-white/40">NONE</span>
                     </div>`
                  }
                </div>
                <span class="text-[10px] sm:text-[12px] text-gray-400 font-medium uppercase tracking-wider">Mobile</span>
            </div>
        </div>

        <!-- Content & Info -->
        <div class="flex-1 min-w-0 flex flex-col gap-3">
            <div class="flex items-center justify-between lg:justify-start gap-3">
                <h4 class="font-['Poppins'] font-semibold text-[16px] sm:text-[18px] text-black truncate">${b.title}</h4>
                <div class="lg:hidden flex items-center gap-2">
                    <span class="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-bold text-gray-500">POS: ${b.position || 1}</span>
                </div>
            </div>
            
            <div class="flex items-center bg-[#EDEDED] rounded-[5px] h-[36px] px-3 w-full lg:max-w-[350px]">
                <img src="../../assets/icons/admin/search.svg" class="w-3.5 h-3.5 mr-2 opacity-50 rotate-45" style="filter: grayscale(1);">
                <input type="text" readonly value="${b.link || 'https://example.com'}" class="bg-transparent outline-none text-[#656565] text-[13px] sm:text-[14px] w-full truncate">
            </div>

            <div class="flex flex-wrap items-center gap-x-6 gap-y-3 mt-1">
                <div class="hidden lg:flex items-center gap-3">
                    <span class="font-medium text-[14px] sm:text-[15px] text-gray-600">Position</span>
                    <div class="min-w-[35px] h-[26px] px-2 bg-[#EDEDED] rounded-[3px] flex items-center justify-center font-bold text-[14px] sm:text-[15px]">${b.position || 1}</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-medium text-[14px] sm:text-[15px] text-gray-600">Status</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${b.isActive ? 'checked' : ''} onchange="toggleBannerById('${b._id}','${type}')">
                        <div class="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#BE2229]"></div>
                        <span class="ml-2 text-[12px] sm:text-[13px] font-medium text-gray-500">${b.isActive ? 'Active' : 'Inactive'}</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-row lg:flex-col gap-2 w-full lg:w-[140px] border-t lg:border-t-0 border-gray-100 pt-4 lg:pt-0">
            <button onclick="editBannerById('${b._id}')" class="flex-1 lg:flex-none h-[32px] border border-[#B9B9B9] rounded-[6px] flex items-center justify-center gap-2 text-[13px] sm:text-[14px] font-medium hover:bg-gray-50 transition shadow-sm bg-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Edit
            </button>
            <button onclick="deleteBannerById('${b._id}','${b.title.replace(/'/g,"\\'")}','${type}')" class="flex-1 lg:flex-none h-[32px] border border-[#B9B9B9] rounded-[6px] flex items-center justify-center gap-2 text-[13px] sm:text-[14px] font-medium hover:bg-red-50 hover:text-red-600 transition shadow-sm bg-white">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                Remove
            </button>
            <button class="hidden lg:flex w-full h-[32px] border border-[#B9B9B9] rounded-[6px] items-center justify-center gap-2 text-[13px] sm:text-[14px] font-medium cursor-default opacity-60 bg-gray-50">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Published
            </button>
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<div class="text-center py-8 text-red-500 text-[14px]">Error: ${err.message}</div>`;
  }
}

function openBannerModal(title = 'Add New Banner') {
  setText('banner-modal-title', title);
  const overlay = document.getElementById('banner-modal-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  }
  document.body.style.overflow = 'hidden';
}

function closeBannerModal() {
  const overlay = document.getElementById('banner-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
  document.body.style.overflow = '';
  editBannerId = null;
  
  // Reset form fields
  ['banner-title-input','banner-link-input','banner-alt-input','banner-start-date','banner-end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const posInput = document.getElementById('banner-position-input');
  const sortInput = document.getElementById('banner-sort-order-input');
  if (posInput) posInput.value = '1'; 
  if (sortInput) sortInput.value = '0';
  
  const desktopInput = document.getElementById('banner-file-input');
  const mobileInput  = document.getElementById('banner-mobile-input');
  if (desktopInput) desktopInput.value = '';
  if (mobileInput)  mobileInput.value = '';
  
  const dpv = document.getElementById('banner-file-preview');
  const mpv = document.getElementById('banner-mobile-preview');
  if (dpv) dpv.classList.add('hidden');
  if (mpv) mpv.classList.add('hidden');
}

async function editBannerById(id) {
  editBannerId = id;
  try {
    const data = await api.get(`/banners/${id}`);
    if (!data) return;
    const b = data.banner;
    openBannerModal('Edit Banner');
    
    const fieldMap = {
      'banner-title-input': b.title,
      'banner-link-input': b.link,
      'banner-alt-input': b.altText,
      'banner-position-input': b.position || 1,
      'banner-sort-order-input': b.sortOrder || 0
    };
    
    Object.entries(fieldMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val === null ? '' : val;
    });

    if (b.startDate) { const el = document.getElementById('banner-start-date'); if (el) el.value = b.startDate.split('T')[0]; }
    if (b.endDate)   { const el = document.getElementById('banner-end-date');   if (el) el.value = b.endDate.split('T')[0]; }
    
    // Desktop preview
    const dpv  = document.getElementById('banner-file-preview');
    const dimg = document.getElementById('banner-preview-img');
    if (dpv && dimg) { dimg.src = imageUrl(b.image); dpv.classList.remove('hidden'); }
    
    // Mobile preview
    const mpv  = document.getElementById('banner-mobile-preview');
    const mimg = document.getElementById('banner-mobile-preview-img');
    if (mpv && mimg && b.mobileImage) { mimg.src = imageUrl(b.mobileImage); mpv.classList.remove('hidden'); }
    else if (mpv) { mpv.classList.add('hidden'); }
    
  } catch (err) { showToast('Load error: ' + err.message, 'error'); }
}

/**
 * CENTRALIZED FORMDATA BUILDER
 * One shared pipeline for ALL banner types.
 * Ensures consistent field names and safe File object appending.
 */
function buildBannerFormData(type) {
  const fd = new FormData();
  
  // 1. Text Fields & Metadata
  const title = document.getElementById('banner-title-input')?.value?.trim();
  const link = document.getElementById('banner-link-input')?.value?.trim() || '';
  const altText = document.getElementById('banner-alt-input')?.value?.trim() || title;
  const position = document.getElementById('banner-position-input')?.value || '1';
  const sortOrder = document.getElementById('banner-sort-order-input')?.value || '0';
  const startDate = document.getElementById('banner-start-date')?.value;
  const endDate = document.getElementById('banner-end-date')?.value;

  fd.append('title', title);
  fd.append('type', type);
  fd.append('link', link);
  fd.append('altText', altText);
  fd.append('position', position);
  fd.append('sortOrder', sortOrder);
  
  if (startDate) fd.append('startDate', startDate);
  if (endDate) fd.append('endDate', endDate);

  // 2. Desktop Image Appending
  const desktopInput = document.getElementById('banner-file-input');
  const desktopFile = desktopInput?.files?.[0];
  if (desktopFile instanceof File) {
    fd.append('image', desktopFile);
    console.log(`[BANNER-UPLOAD] Desktop Image Detected: ${desktopFile.name}`);
  }

  // 3. Mobile Image Appending (CRITICAL FIX)
  // Consistently uses 'mobileImage' field name for Multer/Mongo compatibility
  const mobileInput = document.getElementById('banner-mobile-input');
  const mobileFile = mobileInput?.files?.[0];
  if (mobileFile instanceof File) {
    fd.append('mobileImage', mobileFile);
    console.log(`[BANNER-UPLOAD] Mobile Image Detected: ${mobileFile.name}`);
  } else {
    console.log(`[BANNER-UPLOAD] No new mobile image selected.`);
  }

  return { fd, title, desktopFile, mobileFile };
}

async function saveBanner(type) {
  const saveBtn = document.getElementById('save-banner-btn');
  
  // 1. Build Centralized FormData
  const { fd, title, desktopFile, mobileFile } = buildBannerFormData(type);

  // 2. SHARED VALIDATION
  if (!title) {
    showToast('Banner title is required', 'error');
    return;
  }

  // Requirement: New banners must have at least a desktop image
  if (!editBannerId && (!desktopFile || !(desktopFile instanceof File))) {
    showToast('Desktop image is required for new banners', 'error');
    return;
  }

  // File Type Validation
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (desktopFile && !allowedTypes.includes(desktopFile.type)) {
    showToast('Invalid desktop image type. Please use JPG, PNG, or WEBP.', 'error');
    return;
  }
  if (mobileFile && !allowedTypes.includes(mobileFile.type)) {
    showToast('Invalid mobile image type. Please use JPG, PNG, or WEBP.', 'error');
    return;
  }

  // 3. EXECUTE UPLOAD
  if (saveBtn) { 
    saveBtn.disabled = true; 
    saveBtn.textContent = 'Uploading...'; 
  }

  try {
    let result;
    if (editBannerId) {
      console.log(`[BANNER-UPLOAD] Updating banner: ${editBannerId}`);
      result = await api.put(`/banners/${editBannerId}`, fd);
      showToast('Banner updated successfully!', 'success');
    } else {
      console.log(`[BANNER-UPLOAD] Creating new banner of type: ${type}`);
      result = await api.post('/banners', fd);
      showToast('Banner created successfully!', 'success');
    }
    
    if (result) {
      closeBannerModal();
      await loadBanners(type);
    }
  } catch (err) {
    console.error('[BANNER-UPLOAD-ERROR]', err);
    showToast(err.message || 'Upload failed', 'error');
  } finally {
    if (saveBtn) { 
      saveBtn.disabled = false; 
      saveBtn.textContent = 'Save Banner'; 
    }
  }
}

async function toggleBannerById(id, type) {
  try {
    const data = await api.patch(`/banners/${id}/toggle`);
    showToast(`Banner ${data.isActive ? 'activated' : 'hidden'}`, 'success');
    await loadBanners(type);
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteBannerById(id, title, type) {
  showConfirm(`Delete banner "<strong>${title}</strong>"? Both images will be permanently deleted.`, async () => {
    try {
      await api.delete(`/banners/${id}`);
      showToast('Banner deleted', 'success');
      await loadBanners(type);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function bindBannerEvents(type) {
  document.getElementById('add-banner-btn')?.addEventListener('click', () => { editBannerId = null; openBannerModal(); });
  document.getElementById('cancel-banner-btn')?.addEventListener('click', closeBannerModal);
  document.getElementById('banner-modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'banner-modal-overlay') closeBannerModal(); });
  document.getElementById('save-banner-btn')?.addEventListener('click', () => saveBanner(type));

  // Desktop preview
  document.getElementById('banner-file-input')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const pv  = document.getElementById('banner-file-preview');
      const img = document.getElementById('banner-preview-img');
      if (img) img.src = ev.target.result;
      if (pv) pv.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // Mobile preview
  document.getElementById('banner-mobile-input')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const pv  = document.getElementById('banner-mobile-preview');
      const img = document.getElementById('banner-mobile-preview-img');
      if (img) img.src = ev.target.result;
      if (pv) pv.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // Filters
  const searchEl = document.getElementById('banner-search');
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { currentFilters.search = searchEl.value.trim(); loadBanners(type); }, 350);
    });
  }

  document.getElementById('banner-status-filter')?.addEventListener('change', e => {
    currentFilters.isActive = e.target.value;
    loadBanners(type);
  });

  document.getElementById('banner-sort')?.addEventListener('change', e => {
    currentFilters.sort = e.target.value;
    loadBanners(type);
  });

  document.getElementById('refresh-banners')?.addEventListener('click', () => {
    if (searchEl) searchEl.value = '';
    const sf = document.getElementById('banner-status-filter');
    const st = document.getElementById('banner-sort');
    if (sf) sf.value = '';
    if (st) st.value = '';
    currentFilters = { search: '', isActive: '', sort: '' };
    loadBanners(type);
  });
}

