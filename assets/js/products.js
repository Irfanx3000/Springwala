/**
 * products.js
 * Matches: admin/products/product-list.html AND admin/products/add-product.html
 * Handles: list, search, filter, toggle, delete, create, edit, image slots
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar();
  initAdminHeader();

  if (document.getElementById('products-tbody')) {
    // ── Product List Page ──────────────────────────────────────────────────────
    await populateFilterCategories();
    await loadProducts(1);
    bindProductListEvents();
  }

  if (document.getElementById('add-product-form') || document.getElementById('product-name')) {
    // ── Add / Edit Product Page ────────────────────────────────────────────────
    await populateCategoryDropdown();
    bindProductFormEvents();

    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) await prefillEditForm(editId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT LIST
// ─────────────────────────────────────────────────────────────────────────────
let currentPage = 1;
let listFilters = {};
const LIMIT = 15;
let currentStatusTab = 'all'; 

async function loadProducts(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('products-tbody');
  const mlist = document.getElementById('products-mobile-list');
  if (!tbody && !mlist) return;

  const skeleton = Array(6).fill(`<div class="h-20 bg-gray-100 rounded animate-pulse w-full mb-2"></div>`).join('');
  if (tbody) tbody.innerHTML = skeleton;
  if (mlist) mlist.innerHTML = skeleton;

  try {
    const params = { page, limit: LIMIT, ...listFilters };
    const data = await api.get('/products', params);
    if (!data) return;

    // Update stats
    setText('stat-total-products', data.total || 0);
    setText('stat-active-products', data.active || 0);
    setText('stat-low-stock', data.lowStock || 0);
    setText('stat-out-of-stock', data.outOfStock || 0);
    
    if (!data.products.length) {
      const emptyMsg = `<div class="text-center py-16 text-gray-400 w-full">No products found.</div>`;
      if (tbody) tbody.innerHTML = emptyMsg;
      if (mlist) mlist.innerHTML = emptyMsg;
      setText('products-count-text', '0 products');
      return;
    }

    // Render Desktop Table
    if (tbody) {
      tbody.innerHTML = data.products.map(p => `
        <div class="grid grid-cols-[50px_90px_minmax(150px,1fr)_120px_140px_70px_90px_100px_80px_90px_110px] w-full min-w-[1100px] h-[87px] bg-[#F6F6F6] border border-[#DADADA] rounded-[5px] items-center px-2">
            <div class="flex items-center justify-center w-full">
                <input type="checkbox" data-id="${p._id}" class="product-row-checkbox w-[21px] h-[21px] accent-[#BE2229] cursor-pointer" />
            </div>
            <div class="flex items-center justify-center w-full">
                <div class="w-[72px] h-[72px] bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-100">
                    ${p.images?.[0] ? `<img src="${imageUrl(p.images[0])}" class="max-w-full max-h-full object-contain">` : `<img src="../../assets/images/header.png" class="opacity-20 max-w-[50%]">`}
                </div>
            </div>
            <div class="font-['Roboto'] font-normal text-[16px] text-black text-left pl-2 overflow-hidden text-ellipsis whitespace-nowrap">${p.name}</div>
            <div class="font-['Roboto'] text-[15px] text-center">${p.sku || '—'}</div>
            <div class="font-['Roboto'] text-[15px] text-center">${p.subcategory?.name || p.category?.name || '—'}</div>
            <div class="font-['Roboto'] font-bold text-[17px] text-center ${p.stock <= p.lowStockThreshold ? 'text-red-500' : ''}">${p.stock}</div>
            <div class="font-['Roboto'] text-[15px] text-center">${p.stock || 0}</div>
            <div class="flex items-center justify-center">
                <div class="px-3 py-1 rounded-full text-[13px] ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${p.isActive ? 'Active' : 'Draft'}</div>
            </div>
            <div class="font-['Roboto'] text-[15px] text-center text-red-600">${p.discountPercent}%</div>
            <div class="font-['Roboto'] font-bold text-[16px] text-center">₹${(p.discountedPrice || p.price).toLocaleString()}</div>
            <div class="flex items-center justify-center gap-4">
                <button onclick="toggleProductActive('${p._id}')" class="hover:opacity-75 ${p.isActive ? '' : 'opacity-40'}" title="Toggle Visibility">
                    <img src="../../assets/icons/admin/eye.svg" class="w-[22px] h-[15px]">
                </button>
                <button onclick="deleteProductById('${p._id}','${p.name.replace(/'/g,"\\'")}')" class="hover:opacity-75">
                    <img src="../../assets/icons/admin/delete.svg" class="w-[16px] h-[18px]">
                </button>
                <button onclick="window.location.href='add-product.html?id=${p._id}'" class="hover:opacity-75">
                    <img src="../../assets/icons/admin/pencil.svg" class="w-[18px] h-[18px]">
                </button>
            </div>
        </div>`).join('');
    }

    // Render Mobile Cards
    if (mlist) {
      mlist.innerHTML = data.products.map(p => `
        <div class="bg-white rounded-[10px] box-shadow-card p-4 flex flex-col gap-4 border border-[#DADADA]">
            <div class="flex items-center justify-between border-b pb-3 border-[#E5E5E5]">
                <div class="flex items-center gap-3">
                    <input type="checkbox" data-id="${p._id}" class="w-[21px] h-[21px] accent-[#BE2229]" />
                    <div class="font-['Roboto'] font-medium text-[17px] text-black">${p.sku || 'No SKU'}</div>
                </div>
                <div class="px-3 py-1 rounded-full text-[12px] ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${p.isActive ? 'Active' : 'Draft'}</div>
            </div>
            <div class="flex gap-4">
                <div class="w-[80px] h-[80px] bg-white rounded-[5px] flex items-center justify-center border border-gray-100 shrink-0">
                    ${p.images?.[0] ? `<img src="${imageUrl(p.images[0])}" class="max-w-full max-h-full object-contain">` : `<img src="../../assets/images/header.png" class="opacity-10 max-w-[50%]">`}
                </div>
                <div class="flex flex-col gap-1 flex-1">
                    <h3 class="font-['Roboto'] font-semibold text-[16px] text-black line-clamp-2">${p.name}</h3>
                    <p class="font-['Roboto'] text-[14px] text-gray-500">${p.category?.name || ''}</p>
                    <p class="font-['Roboto'] text-[14px] text-gray-500">Stock: <span class="text-black font-medium underline ${p.stock <= p.lowStockThreshold ? 'text-red-600' : ''}">${p.stock}</span></p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 border-t border-[#E5E5E5] pt-3">
                <div class="flex flex-col items-center">
                    <span class="text-[12px] text-gray-500">Discount</span>
                    <span class="text-[15px] font-medium text-red-600">${p.discountPercent}%</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="text-[12px] text-gray-500">Final Price</span>
                    <span class="text-[15px] font-bold text-black">₹${(p.discountedPrice || p.price).toLocaleString()}</span>
                </div>
            </div>
            <div class="flex justify-end gap-5 pt-2">
                <button onclick="toggleProductActive('${p._id}')" class="w-6 h-4 hover:opacity-75 ${p.isActive ? '' : 'opacity-40'}"><img src="../../assets/icons/admin/eye.svg"></button>
                <button onclick="deleteProductById('${p._id}','${p.name.replace(/'/g,"\\'")}')" class="w-5 h-5 hover:opacity-75"><img src="../../assets/icons/admin/delete.svg"></button>
                <button onclick="window.location.href='add-product.html?id=${p._id}'" class="w-5 h-5 hover:opacity-75"><img src="../../assets/icons/admin/pencil.svg"></button>
            </div>
        </div>`).join('');
    }

    const start = (page - 1) * LIMIT + 1;
    const end   = Math.min(page * LIMIT, data.total);
    setText('products-count-text', `${start}–${end} of ${data.total}`);
    buildPagination('products-pagination', page, data.pages || Math.ceil(data.total / LIMIT), loadProducts);
  } catch (err) {
    if (tbody) tbody.innerHTML = `<div class="text-center py-8 text-red-500 text-[14px]">Error: ${err.message}</div>`;
    if (mlist) mlist.innerHTML = `<div class="text-center py-8 text-red-500">Error: ${err.message}</div>`;
  }
}

async function toggleProductActive(id) {
  try {
    const data = await api.patch(`/products/${id}/toggle`);
    showToast(`Product ${data.isActive ? 'activated' : 'deactivated'}`, 'success');
    await loadProducts(currentPage);
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteProductById(id, name) {
  showConfirm(`Delete "<strong>${name}</strong>"? All images will also be removed. This cannot be undone.`, async () => {
    try {
      await api.delete(`/products/${id}`);
      showToast('Product deleted successfully', 'success');
      await loadProducts(currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function populateFilterCategories() {
  const select = document.getElementById('category-filter');
  if (!select) return;
  try {
    const data = await api.get('/categories/dropdown');
    if (data?.categories) {
      select.innerHTML = '<option value="">All Categories</option>' + 
        data.categories.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    }
  } catch(err) { console.error('Filter categories error:', err); }
}

function bindProductListEvents() {
  const searchEl = document.getElementById('product-search');
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { listFilters.search = searchEl.value.trim() || undefined; loadProducts(1); }, 350);
    });
  }

  document.getElementById('category-filter')?.addEventListener('change', e => {
    listFilters.category = e.target.value || undefined; loadProducts(1);
  });

  document.getElementById('stock-filter')?.addEventListener('change', e => {
    listFilters.stockStatus = e.target.value || undefined; loadProducts(1);
  });

  document.getElementById('sort-filter')?.addEventListener('change', e => {
    const [field, dir] = e.target.value.startsWith('-') ? [e.target.value.substring(1), 'desc'] : [e.target.value, 'asc'];
    listFilters.sortBy = field; listFilters.order = dir; loadProducts(1);
  });

  // Bulk Actions
  document.getElementById('bulk-view-btn')?.addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.product-row-checkbox:checked, #products-mobile-list input[type="checkbox"]:checked'))
      .map(cb => cb.getAttribute('data-id')).filter(id => !!id);

    if (!selectedIds.length) return showToast('Select products first', 'warning');

    const actionText = (currentStatusTab === 'hidden' || currentStatusTab === 'draft') ? 'Activate' : 'Deactivate';
    const newStatus = (currentStatusTab === 'hidden' || currentStatusTab === 'draft');

    showConfirm(`${actionText} ${selectedIds.length} selected products?`, async () => {
      try {
        await api.patch('/products/bulk-status', { ids: selectedIds, isActive: newStatus });
        showToast(`Products ${actionText.toLowerCase()}d`, 'success');
        loadProducts(currentPage);
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.product-row-checkbox:checked, #products-mobile-list input[type="checkbox"]:checked'))
      .map(cb => {
        // Find the parent and check for ID attributes or sibling data
        // For simplicity, I'll update the render to include data-id on checkboxes
        return cb.getAttribute('data-id');
      }).filter(id => !!id);

    if (!selectedIds.length) return showToast('Select products first', 'warning');

    showConfirm(`Delete ${selectedIds.length} selected products?`, async () => {
      try {
        await api.post('/products/bulk-delete', { ids: selectedIds });
        showToast('Products deleted', 'success');
        loadProducts(currentPage);
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  // Tabs (All, Hidden, Draft)
  const tabs = document.querySelectorAll('.product-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active-tab');
        t.classList.add('text-[#A4A4A4]', 'pb-1');
      });
      tab.classList.add('active-tab');
      tab.classList.remove('text-[#A4A4A4]', 'pb-1');

      const status = tab.getAttribute('data-status');
      currentStatusTab = status;
      if (status === 'all')    listFilters.isActive = undefined;
      else if (status === 'hidden') listFilters.isActive = 'false';
      else if (status === 'draft')  listFilters.isActive = 'false'; 
      
      loadProducts(1);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD / EDIT PRODUCT FORM
// ─────────────────────────────────────────────────────────────────────────────
let editingProductId = null;
let slotFiles = [null, null, null, null]; // tracks File objects per slot

async function populateCategoryDropdown() {
  const select = document.getElementById('product-category');
  if (!select) return;

  try {
    const data = await api.get('/categories/dropdown');
    if (!data) return;

    const topLevel = data.categories.filter(c => !c.parentCategory);
    select.innerHTML = `<option value="" disabled selected hidden>Select Category...</option>` +
      topLevel.map(c => `<option value="${c._id}">${c.name}</option>`).join('');

    // When category changes → load sub-categories into a sub-category select if it exists
    select.addEventListener('change', async () => {
      const subEl = document.getElementById('product-subcategory');
      if (!subEl) return;
      if (!select.value) { subEl.innerHTML = '<option value="">No Sub-category</option>'; return; }

      try {
        const catData = await api.get(`/categories/${select.value}`);
        const subs = catData?.category?.subcategories || [];
        subEl.innerHTML = `<option value="">No Sub-category</option>` +
          subs.map(s => `<option value="${s._id}">${s.name}</option>`).join('');
      } catch {}
    });
  } catch (err) {
    console.error('Category dropdown error:', err.message);
  }
}

// Calculate final price live
function calcFinalPrice() {
  const price    = parseFloat(document.getElementById('product-price')?.value || 0);
  const discount = parseFloat(document.getElementById('product-discount')?.value || 0);
  const gst      = parseFloat(document.getElementById('product-gst')?.value || 0);

  if (!price) { const fp = document.getElementById('product-final-price'); if (fp) fp.value = ''; return; }

  const afterDiscount = price - (price * discount / 100);
  const withGst       = afterDiscount + (afterDiscount * gst / 100);
  const fp = document.getElementById('product-final-price');
  if (fp) fp.value = '₹' + withGst.toFixed(2);

  // Also store the discounted price for backend
  const dpEl = document.getElementById('product-discounted-price-hidden');
  if (dpEl) dpEl.value = afterDiscount.toFixed(2);

  // Update Batch Prices automatically
  updateBatchPrices(withGst);
}

// ─── Batch Pricing Logic ────────────────────────────────────────────────────────
function updateBatchPrices(unitPriceOverride) {
  let unitPrice = unitPriceOverride;
  if (unitPrice === undefined) {
    const fpValue = document.getElementById('product-final-price')?.value || '';
    unitPrice = parseFloat(fpValue.replace(/[^\d.]/g, '')) || 0;
  }

  const rows = document.querySelectorAll('.batch-row');
  rows.forEach(row => {
    const qtyInput = row.querySelector('.quantity-input');
    const priceInput = row.querySelector('.batch-price');
    
    if (qtyInput && priceInput) {
      // Only auto-update if NOT manually overridden
      if (!priceInput.classList.contains('manual-price')) {
        const qty = parseFloat(qtyInput.value) || 0;
        const total = unitPrice * qty;
        priceInput.value = total > 0 ? total.toFixed(2) : '';
      }
    }
  });
}

function bindBatchRowEvents(row) {
  const qtyInput = row.querySelector('.quantity-input');
  const priceInput = row.querySelector('.batch-price');

  qtyInput?.addEventListener('input', () => updateBatchPrices());
  
  priceInput?.addEventListener('input', () => {
    if (priceInput.value !== '') {
      priceInput.classList.add('manual-price');
      priceInput.classList.add('!bg-yellow-50'); // Subtle yellow background
      priceInput.classList.add('border-yellow-200');
      priceInput.title = "Custom Price Applied";
    } else {
      priceInput.classList.remove('manual-price');
      priceInput.classList.remove('!bg-yellow-50');
      priceInput.classList.remove('border-yellow-200');
      updateBatchPrices(); // Recalculate if cleared
    }
  });
}

function bindProductFormEvents() {
  // Price/discount/gst live calculation
  ['product-price', 'product-discount', 'product-gst'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcFinalPrice);
  });

  // Image upload slots
  const imageInput = document.getElementById('image-upload-input');
  if (imageInput) {
    imageInput.addEventListener('change', e => {
      Array.from(e.target.files).forEach(file => assignFileToSlot(file));
      imageInput.value = ''; // reset so same file can be re-added
    });
  }

  // Slot delete buttons — wire all 4
  for (let i = 1; i <= 4; i++) {
    const slot = document.getElementById(`slot-${i}`);
    if (!slot) continue;
    const deleteBtn = slot.querySelector('.delete-btn');
    const img = slot.querySelector('.preview-img');
    deleteBtn?.addEventListener('click', e => {
      e.stopPropagation();
      slotFiles[i - 1] = null;
      if (img) { img.src = ''; img.classList.add('hidden'); }
      deleteBtn.classList.add('hidden');
      // Remove existing URL marker if editing
      slot.removeAttribute('data-existing-url');
    });
    // Make slot clickable to upload
    slot.addEventListener('click', () => imageInput?.click());
  }

  // Refresh / Clear buttons
  document.getElementById('refresh-product-info')?.addEventListener('click', () => clearSection(['product-name', 'product-category', 'product-brand', 'product-sku', 'product-description']));
  document.getElementById('refresh-pricing')?.addEventListener('click', () => clearSection(['product-price', 'product-discount', 'product-gst', 'product-final-price']));
  document.getElementById('refresh-shipping')?.addEventListener('click', () => clearSection(['product-unit-weight']));
  document.getElementById('refresh-featured')?.addEventListener('click', () => {
    const feat = document.getElementById('product-featured');
    if (feat) feat.checked = false;
  });

  // Save / Publish buttons
  document.getElementById('save-draft-btn')?.addEventListener('click', () => submitProductForm(false));
  document.getElementById('publish-btn')?.addEventListener('click', () => submitProductForm(true));

  // Initial Batch Row Events
  document.querySelectorAll('.batch-row').forEach(row => bindBatchRowEvents(row));

  // Add Batch Button (need to observe changes if added dynamically)
  // Actually add-product.html has its own script for adding batches, 
  // so we should ideally hook into that or use a MutationObserver.
  // BUT the user wants it in products.js if possible or integrated.
  // I will add a global listener for dynamic rows.
  document.getElementById('inventory-container')?.addEventListener('click', (e) => {
    if (e.target.id === 'add-batch-btn') {
      // Wait for DOM update
      setTimeout(() => {
        const rows = document.querySelectorAll('.batch-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) bindBatchRowEvents(lastRow);
      }, 50);
    }
  });

  // Main form submit (if wrapped in a form tag)
  document.getElementById('add-product-form')?.addEventListener('submit', e => { e.preventDefault(); submitProductForm(true); });
}

function clearSection(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }

function assignFileToSlot(file) {
  const slotIndex = slotFiles.findIndex(f => f === null);
  if (slotIndex === -1) { showToast('Maximum 4 images allowed. Delete one first.', 'warning'); return; }

  const slot     = document.getElementById(`slot-${slotIndex + 1}`);
  const img      = slot?.querySelector('.preview-img');
  const deleteBtn = slot?.querySelector('.delete-btn');

  if (!slot || !img) return;
  slotFiles[slotIndex] = file;

  const reader = new FileReader();
  reader.onload = ev => {
    img.src = ev.target.result;
    img.classList.remove('hidden');
    deleteBtn?.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function prefillEditForm(productId) {
  editingProductId = productId;

  // Update page title
  const titleEl = document.querySelector('h2.font-medium');
  if (titleEl) titleEl.textContent = 'Edit Product';

  const publishBtn = document.getElementById('publish-btn');
  if (publishBtn) publishBtn.textContent = 'Update Product';

  try {
    const data = await api.get(`/products/${productId}`);
    if (!data) return;
    const p = data.product;

    // Fill text fields
    const fieldMap = {
      'product-name': p.name,
      'product-brand': p.brand,
      'product-sku': p.sku,
      'short-description': p.shortDescription,
      'long-description': p.description,
      'product-hsn': p.hsnCode,
      'product-price': p.price,
      'product-discount': p.discountPercent,
      'product-gst': p.gstPercent,
      'product-unit-weight': p.weight,
      'product-weight-unit': p.weightUnit,
      'product-type': p.type,
    };
    Object.entries(fieldMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    });

    // Stock
    const stockInputs = document.querySelectorAll('.quantity-input');
    if (stockInputs[0]) stockInputs[0].value = p.stock || 0;

    // Category
    const catEl = document.getElementById('product-category');
    if (catEl && p.category) {
      catEl.value = p.category._id || p.category;
      catEl.dispatchEvent(new Event('change'));
      setTimeout(() => {
        const subEl = document.getElementById('product-subcategory');
        if (subEl && p.subcategory) subEl.value = p.subcategory._id || p.subcategory;
      }, 600);
    }

    // Featured toggle
    const featuredEl = document.getElementById('product-featured');
    if (featuredEl) featuredEl.checked = p.isFeatured === true;

    // Status dropdown
    const statusEl = document.getElementById('product-status');
    if (statusEl) statusEl.value = p.isActive ? 'published' : 'draft';

    calcFinalPrice();

    // Load existing images into slots
    (p.images || []).slice(0, 4).forEach((url, i) => {
      const slot      = document.getElementById(`slot-${i + 1}`);
      const img       = slot?.querySelector('.preview-img');
      const deleteBtn = slot?.querySelector('.delete-btn');
      if (!slot || !img) return;
      img.src = imageUrl(url);
      img.classList.remove('hidden');
      deleteBtn?.classList.remove('hidden');
      slot.setAttribute('data-existing-url', url); // mark as existing
    });

    // Load features (specifications)
    if (p.specifications?.length) {
      p.specifications.forEach((spec, i) => {
        if (i > 0) document.getElementById('add-feature-btn')?.click();
        const rows = document.querySelectorAll('.feature-row');
        const row = rows[i];
        if (!row) return;
        const keyEl = row.querySelector('.feature-key');
        const valEl = row.querySelector('.feature-value');
        if (keyEl) keyEl.value = spec.key;
        if (valEl) valEl.value = spec.value;
      });
    }

    // Load Batches
    if (p.batches?.length) {
      // First row is already there
      p.batches.forEach((b, i) => {
        if (i > 0) document.getElementById('add-batch-btn')?.click();
        const rows = document.querySelectorAll('.batch-row');
        const row = rows[i];
        if (!row) return;
        const qInput = row.querySelector('.quantity-input');
        const pInput = row.querySelector('.batch-price');
        
        if (qInput) qInput.value = b.quantity || 0;
        if (pInput) {
          pInput.value = b.price || 0;
          // Check if it was manual
          const unitPriceValue = document.getElementById('product-final-price')?.value || '';
          const unitPrice = parseFloat(unitPriceValue.replace(/[^\d.]/g, '')) || 0;
          if (unitPrice > 0 && Math.abs(parseFloat(b.price) - (unitPrice * b.quantity)) > 0.1) {
            pInput.classList.add('manual-price');
            pInput.classList.add('!bg-yellow-50');
            pInput.classList.add('border-yellow-200');
            pInput.title = "Custom Price Applied";
          }
        }
      });
      if (typeof updateBatchWeights === 'function') updateBatchWeights();
    }
  } catch (err) {
    showToast('Failed to load product: ' + err.message, 'error');
  }
}

async function submitProductForm(publish = true) {
  const name     = document.getElementById('product-name')?.value?.trim();
  const category = document.getElementById('product-category')?.value;
  const price    = document.getElementById('product-price')?.value;

  if (!name)     { showToast('Product name is required', 'error'); document.getElementById('product-name')?.focus(); return; }
  if (!category) { showToast('Please select a category', 'error'); return; }
  if (!price)    { showToast('Please enter a price', 'error'); document.getElementById('product-price')?.focus(); return; }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('category', category);
  formData.append('price', price);
  formData.append('isActive', publish ? 'true' : 'false');
  formData.append('isFeatured', document.getElementById('product-featured')?.checked ? 'true' : 'false');

  const optFields = {
    'product-brand':       'brand',
    'product-sku':         'sku',
    'short-description':   'shortDescription',
    'long-description':    'description',
    'product-hsn':         'hsnCode',
    'product-discount':    'discountPercent',
    'product-gst':         'gstPercent',
    'product-unit-weight': 'weight',
    'product-weight-unit': 'weightUnit',
    'product-type':        'type',
  };
  Object.entries(optFields).forEach(([id, key]) => {
    const val = document.getElementById(id)?.value?.trim();
    formData.append(key, val || '');
  });

  // Discounted price
  const rawPrice    = parseFloat(price);
  const discount    = parseFloat(document.getElementById('product-discount')?.value || 0);
  const discounted  = rawPrice - (rawPrice * discount / 100);
  formData.append('discountedPrice', discounted.toFixed(2));

  // Stock & Batches
  const batchRows = document.querySelectorAll('.batch-row');
  const batches = [];
  let totalStock = 0;
  
  batchRows.forEach(row => {
    const qty = parseFloat(row.querySelector('.quantity-input')?.value || 0);
    const price = parseFloat(row.querySelector('.batch-price')?.value || 0);
    
    if (qty > 0) {
      batches.push({ quantity: qty, price: price });
      totalStock += qty;
    }
  });
  
  formData.append('stock', totalStock);
  formData.append('batches', JSON.stringify(batches));

  // Sub-category
  const sub = document.getElementById('product-subcategory')?.value;
  if (sub) formData.append('subcategory', sub);

  // Specifications from feature rows
  const featureRows = document.querySelectorAll('.feature-row');
  const specs = [];
  featureRows.forEach(row => {
    const key = row.querySelector('.feature-key')?.value?.trim();
    const val = row.querySelector('.feature-value')?.value?.trim();
    if (key && val) specs.push({ key, val });
  });
  if (specs.length) formData.append('specifications', JSON.stringify(specs.map(s => ({ key: s.key, value: s.val }))));

  // Images: collect existing ones that weren't deleted
  const existingImages = [];
  for (let i = 1; i <= 4; i++) {
    const url = document.getElementById(`slot-${i}`)?.getAttribute('data-existing-url');
    if (url) existingImages.push(url);
  }
  formData.append('existingImages', JSON.stringify(existingImages));

  // Attach new image files
  slotFiles.forEach(file => { if (file instanceof File) formData.append('images', file); });

  const publishBtn   = document.getElementById('publish-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');
  const activeBtn    = publish ? publishBtn : saveDraftBtn;
  if (activeBtn) { activeBtn.disabled = true; activeBtn.textContent = 'Saving...'; }

  try {
    if (editingProductId) {
      await apiFetch(`/products/${editingProductId}`, { method: 'PUT', body: formData });
      showToast('Product updated successfully!', 'success');
    } else {
      await apiFetch('/products', { method: 'POST', body: formData });
      showToast('Product added successfully!', 'success');
      setTimeout(() => window.location.href = 'product-list.html', 1000);
    }
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    if (activeBtn) {
      activeBtn.disabled = false;
      activeBtn.textContent = editingProductId ? 'Update Product' : (publish ? 'Publish' : 'Save Draft');
    }
  }
}
