/**
 * categories.js
 * Matches: admin/categories.html
 * Full CRUD: create category/subcategory with image, toggle, delete
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  await loadCategories();
  bindCategoryEvents();
});

let editCategoryId = null;
let modalType = 'category'; // 'category' | 'subcategory'
let selectedCategories = new Set();

// ── Load All Categories ────────────────────────────────────────────────────────
async function loadCategories(search = '') {
  const container = document.getElementById('categories-tbody');
  if (!container) return;

  container.innerHTML = `<div class="flex flex-col gap-2 p-4">${Array(4).fill('<div class="h-14 bg-gray-100 rounded-lg animate-pulse"></div>').join('')}</div>`;

  try {
    const params = { limit: 100 };
    if (search) params.search = search;
    
    const statusVal = document.getElementById('category-filter-status')?.value;
    if (statusVal) params.isActive = statusVal;

    const sortVal = document.getElementById('category-sort')?.value;
    if (sortVal) params.sort = sortVal;

    const data = await api.get('/categories', params);
    if (!data) return;

    if (document.getElementById('total-categories')) document.getElementById('total-categories').textContent = data.globalTotalCategories ?? data.total ?? 0;
    if (document.getElementById('total-subcategories')) document.getElementById('total-subcategories').textContent = data.totalSubCategories || 0;
    if (document.getElementById('active-categories')) document.getElementById('active-categories').textContent = data.activeCategoriesCount || 0;
    if (document.getElementById('active-subcategories')) document.getElementById('active-subcategories').textContent = data.activeSubCategoriesCount || 0;
    if (document.getElementById('total-products')) document.getElementById('total-products').textContent = data.totalProducts || 0;

    if (!data.categories.length) {
      container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        <p class="text-[16px]">No categories yet.</p>
        <button onclick="document.getElementById('add-category-btn').click()" class="mt-4 bg-[#BE2229] text-white px-5 py-2 rounded-[7px] text-[14px] hover:bg-red-800 transition">+ Create First Category</button>
      </div>`;
      return;
    }

    container.innerHTML = data.categories.map(cat => buildCategoryRow(cat)).join('');
    bindAccordion();
  } catch (err) {
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-[14px]">Error: ${err.message}</div>`;
  }
}

function buildCategoryRow(cat) {
  const subCount = cat.subcategories?.length || 0;
  const productCount = cat.productCount || 0;
  const dateStr = new Date(cat.createdAt || Date.now()).toLocaleDateString('en-GB');
  const fallback = '../assets/images/deafult.png';
  const isSelected = selectedCategories.has(cat._id);

  const subRows = (cat.subcategories || []).map(sub => `
    <div class="grid grid-cols-[60px_60px_1fr_150px_150px_150px_120px] gap-4 items-center px-4 py-3 bg-[#FAFAFA] border-b border-[#EFEFEF] hover:bg-gray-50 transition">
      <div class="flex items-center justify-end pr-1 gap-2">
        <div class="w-4 h-4 border border-gray-300 rounded-[3px] bg-white hidden sm:block"></div>
      </div>
      <div class="w-10 h-10 rounded-[5px] border border-[#EDEDED] overflow-hidden bg-white flex items-center justify-center mx-auto">
        <img src="${imageUrl(sub.banner)}" class="w-full h-full object-cover" onerror="this.src='${fallback}'">
      </div>
      <p class="font-['Roboto'] font-medium text-[15px] text-[#1E1E1E] truncate">${sub.name}</p>
      <p class="font-['Roboto'] text-[15px] text-center text-black">-</p>
      <p class="font-['Roboto'] text-[15px] text-center text-black">${sub.productCount || 0}</p>
      <p class="font-['Roboto'] text-[15px] text-center text-black">${new Date(sub.createdAt || Date.now()).toLocaleDateString('en-GB')}</p>
      <div class="flex items-center gap-2 justify-center">
         <button onclick="toggleCategoryById('${sub._id}')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Toggle">
          <svg class="w-[18px] h-[18px] ${sub.isActive ? 'opacity-100' : 'opacity-40'}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
        <button onclick="deleteCategoryById('${sub._id}','${sub.name.replace(/'/g,"\\'")}')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Delete">
          <svg class="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
        <button onclick="openEditModal('${sub._id}','subcategory')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Edit">
           <svg class="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
      </div>
    </div>`).join('');

  return `
    <div class="category-wrapper border-b border-[#D7D7D7] last:border-0" data-cat-id="${cat._id}">
      <div class="category-header grid grid-cols-[60px_60px_1fr_150px_150px_150px_120px] gap-4 items-center px-4 py-3 bg-white hover:bg-gray-50/50 transition cursor-pointer">
        <div class="flex items-center gap-2 relative pl-1">
          <input type="checkbox" class="cat-checkbox w-4 h-4 cursor-pointer accent-[#BE2229]" ${isSelected ? 'checked' : ''} onclick="toggleCategorySelection('${cat._id}', event)">
          <svg class="chevron cursor-pointer w-4 h-4 text-black transition-transform duration-200 rotate-0 shrink-0 select-none pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div class="w-10 h-10 rounded-[5px] border border-[#EDEDED] overflow-hidden bg-white flex items-center justify-center mx-auto">
          <img src="${imageUrl(cat.banner)}" class="w-full h-full object-cover" onerror="this.src='${fallback}'">
        </div>
        <p class="font-['Roboto'] font-medium text-[15px] text-[#1E1E1E] truncate">${cat.name}</p>
        <p class="font-['Roboto'] text-[15px] text-center text-black">${subCount}</p>
        <p class="font-['Roboto'] text-[15px] text-center text-black">${productCount}</p>
        <p class="font-['Roboto'] text-[15px] text-center text-black">${dateStr}</p>
        
        <div class="flex items-center gap-2 justify-center" onclick="event.stopPropagation()">
          <button onclick="toggleCategoryById('${cat._id}')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Toggle visibility">
            <svg class="w-[18px] h-[18px] ${cat.isActive ? 'opacity-100' : 'opacity-40'}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
          
          <button onclick="deleteCategoryById('${cat._id}','${cat.name.replace(/'/g,"\\'")}')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Delete">
            <svg class="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
          
          <button onclick="openEditModal('${cat._id}','category')" class="w-[28px] h-[28px] flex items-center justify-center text-[#1E1E1E] hover:bg-gray-200 rounded-[5px] transition" title="Edit">
            <svg class="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
        </div>
      </div>
      <div class="accordion-body bg-[#FAFAFA]" style="max-height:0;overflow:hidden;transition:max-height 0.3s ease">
        ${subRows}
        <div class="flex items-center justify-center p-4">
            <button onclick="openAddSubModal('${cat._id}','${cat.name.replace(/'/g,"\\'")}')" class="bg-[#8C8484] hover:bg-gray-600 transition text-white font-['Roboto'] font-medium text-[14px] px-6 py-2.5 rounded-[5px] shadow-sm tracking-wide">+ Add a new Sub Category</button>
        </div>
      </div>
    </div>`;
}

function bindAccordion() {
  document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
      const wrapper = header.parentElement;
      const body    = wrapper.querySelector('.accordion-body');
      const chevron = header.querySelector('.chevron');
      if (!body) return;
      const open = body.style.maxHeight && body.style.maxHeight !== '0px';
      body.style.maxHeight = open ? '0px' : body.scrollHeight + 'px';
      if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    });
  });
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function openModal(type, data = null) {
  modalType       = type;
  editCategoryId  = data?._id || null;

  setText('modal-title', data ? (type === 'category' ? 'Edit Category' : 'Edit Sub-category') : (type === 'category' ? 'Create a New Category' : 'Create a New Sub-category'));
  const nameLabel = document.getElementById('name-label');
  if (nameLabel) nameLabel.textContent = type === 'category' ? 'Enter Category Name' : 'Enter Sub Category Name';

  const nameInput = document.getElementById('category-name');
  if (nameInput) {
      nameInput.value = data?.name || '';
      nameInput.placeholder = type === 'category' ? 'Category Name' : 'Sub Category Name';
  }
  
  const descInput = document.getElementById('category-description');
  if (descInput) descInput.value = data?.description || '';

  const bannerLabel = document.getElementById('banner-label');
  if (bannerLabel) bannerLabel.textContent = type === 'category' ? 'Category Banner' : 'Sub Category Banner';

  const parentGroup = document.getElementById('parent-category-group');
  if (parentGroup) parentGroup.classList.toggle('hidden', type !== 'subcategory');

  // Reset file preview
  const previewImg   = document.getElementById('preview-img');
  const previewBox   = document.getElementById('banner-preview');
  const uploadBox    = document.getElementById('banner-upload-box');
  const fileInput    = document.getElementById('real-file-input');
  if (fileInput)    fileInput.value = '';
  if (previewImg)   previewImg.src = data?.banner ? imageUrl(data.banner) : '';
  if (previewBox)   previewBox.classList.toggle('hidden', !data?.banner);
  if (uploadBox)    uploadBox.classList.toggle('sm:w-[180px]', !!data?.banner);

  const overlay   = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  }
  setTimeout(() => {
    if (overlay)   overlay.classList.remove('opacity-0');
    if (container) container.classList.remove('scale-95','opacity-0');
  }, 10);
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay   = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  overlay?.classList.add('opacity-0');
  container?.classList.add('scale-95','opacity-0');
  setTimeout(() => { 
    overlay?.classList.add('hidden'); 
    overlay?.classList.remove('flex');
    document.body.style.overflow = ''; 
  }, 280);
  editCategoryId = null;
}

async function openEditModal(id, type) {
  try {
    const data = await api.get(`/categories/${id}`);
    if (data) {
        if (type === 'subcategory') await loadParentDropdown();
        openModal(type, data.category);
        if (type === 'subcategory' && data.category.parentCategory) {
            document.getElementById('parent-category-select').value = data.category.parentCategory;
        }
    }
  } catch (err) { showToast('Load error: ' + err.message, 'error'); }
}

async function openAddSubModal(parentId, parentName) {
  openModal('subcategory');
  await loadParentDropdown();
  const select = document.getElementById('parent-category-select');
  if (select) select.value = parentId;
}

async function loadParentDropdown() {
  const select = document.getElementById('parent-category-select');
  if (!select) return;
  try {
    const data = await api.get('/categories/dropdown');
    const topLevel = (data?.categories || []).filter(c => !c.parentCategory);
    select.innerHTML = '<option value="">Select Parent Category</option>' +
      topLevel.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  } catch {}
}

async function saveCategory() {
  const name = document.getElementById('category-name')?.value?.trim();
  if (!name) { showToast('Category name is required', 'error'); return; }

  const formData = new FormData();
  formData.append('name', name);
  const desc = document.getElementById('category-description')?.value?.trim();
  if (desc) formData.append('description', desc);

  const file = document.getElementById('real-file-input')?.files?.[0];
  if (file) formData.append('banner', file);

  if (modalType === 'subcategory') {
    const parent = document.getElementById('parent-category-select')?.value;
    if (!parent) { showToast('Please select a parent category', 'error'); return; }
    formData.append('parentCategory', parent);
  }

  const saveBtn = document.getElementById('save-category-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    if (editCategoryId) {
      await apiFetch(`/categories/${editCategoryId}`, { method: 'PUT', body: formData });
      showToast('Category updated!', 'success');
    } else {
      await apiFetch('/categories', { method: 'POST', body: formData });
      showToast('Category created!', 'success');
    }
    closeModal();
    await loadCategories();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
  }
}

async function toggleCategoryById(id) {
  try {
    const data = await api.patch(`/categories/${id}/toggle`);
    showToast(`Category ${data.isActive ? 'activated' : 'hidden'}`, 'success');
    await loadCategories();
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteCategoryById(id, name) {
  showConfirm(`Delete category "<strong>${name}</strong>"?<br><small class="text-gray-500">This will fail if the category has products or subcategories.</small>`, async () => {
    try {
      await api.delete(`/categories/${id}`);
      showToast('Category deleted', 'success');
      await loadCategories();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function bindCategoryEvents() {
  document.getElementById('add-category-btn')?.addEventListener('click', () => {
    loadParentDropdown();
    openModal('category');
  });
  document.getElementById('cancel-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('save-category-btn')?.addEventListener('click', saveCategory);

  // File input → preview
  document.getElementById('real-file-input')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img       = document.getElementById('preview-img');
      const preview   = document.getElementById('banner-preview');
      const uploadBox = document.getElementById('banner-upload-box');
      if (img) img.src = ev.target.result;
      if (preview) preview.classList.remove('hidden');
      if (uploadBox) { uploadBox.classList.remove('flex-1'); uploadBox.classList.add('sm:w-[180px]'); }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('banner-upload-box')?.addEventListener('click', () => {
    document.getElementById('real-file-input')?.click();
  });

  // Search and Filters
  const searchEl = document.getElementById('category-search');
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => loadCategories(searchEl.value.trim()), 350);
    });
  }

  document.getElementById('category-filter-status')?.addEventListener('change', () => {
    loadCategories(document.getElementById('category-search')?.value?.trim() || '');
  });
  
  document.getElementById('category-sort')?.addEventListener('change', () => {
    loadCategories(document.getElementById('category-search')?.value?.trim() || '');
  });
}
// ─── Selection Logic ────────────────────────────────────────────────────────
function toggleCategorySelection(id, event) {
  if (event) event.stopPropagation();
  if (selectedCategories.has(id)) selectedCategories.delete(id);
  else selectedCategories.add(id);
  renderOnlySelection();
}

function toggleCategorySelection(id, event) {
  if (event) event.stopPropagation();
  if (selectedCategories.has(id)) selectedCategories.delete(id);
  else selectedCategories.add(id);
  renderOnlySelection();
}

function renderOnlySelection() {
  document.querySelectorAll('.category-wrapper').forEach(wrapper => {
    const id = wrapper.dataset.catId;
    const checkbox = wrapper.querySelector('.cat-checkbox');
    if (checkbox) checkbox.checked = selectedCategories.has(id);
  });
}

async function bulkDelete() {
  if (!selectedCategories.size) return Toast.error('Please select categories to delete');
  
  const ok = await Confirm.show(`Delete ${selectedCategories.size} categories?`, 'This will also delete their subcategories and cannot be undone.', 'Delete All');
  if (!ok) return;

  try {
    const ids = Array.from(selectedCategories);
    // Assuming backend supports bulk delete or we loop
    let successCount = 0;
    for (const id of ids) {
      const res = await api.delete(`/categories/${id}`);
      if (res) successCount++;
    }

    Toast.success(`Successfully deleted ${successCount} categories`);
    selectedCategories.clear();
    loadCategories();
  } catch (err) {
    Toast.error('Bulk delete failed: ' + err.message);
  }
}

// Bind bulk delete button
function bindCategoryEvents() {
    const bulkBtn = document.getElementById('bulk-delete-categories');
    if (bulkBtn) bulkBtn.onclick = bulkDelete;

    const searchInput = document.getElementById('category-search');
    searchInput?.addEventListener('input', (e) => {
        loadCategories(e.target.value);
    });

    ['category-filter-status', 'category-sort'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => loadCategories());
    });
}
