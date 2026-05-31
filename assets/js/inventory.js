/**
 * inventory.js
 * Matches: admin/inventory.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar();
  initAdminHeader();

  await loadInventoryStats();
  await loadInventory(1);
  bindInventoryEvents();
});

let currentPage    = 1;
let activeProductId = null;
let activeFilters  = { isActive: true };
let activeStockType = 'stock_in';
const LIMIT        = 10;

async function loadInventoryStats() {
  try {
    const data = await api.get('/inventory/stats');
    if (!data) return;
    const s = data.stats;
    setText('stat-total-products', s.totalProducts);
    setText('stat-added-month', s.inventoryAddedThisMonth);
    setText('stat-orders-pending', s.ordersPending);
    setText('stat-orders-completed', s.ordersCompleted);
  } catch (err) { console.error(err.message); }
}

async function loadInventory(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('inventory-tbody');
  const mobileTbody = document.getElementById('inventory-mobile-tbody');
  if (!tbody) return;

  const skeletonDesktop = Array(4).fill(`<div class="w-full h-[87px] bg-gray-50 rounded-[5px] animate-pulse"></div>`).join('');
  const skeletonMobile = Array(4).fill(`<div class="w-full h-[150px] bg-gray-50 rounded-[10px] animate-pulse"></div>`).join('');
  
  tbody.innerHTML = skeletonDesktop;
  if(mobileTbody) mobileTbody.innerHTML = skeletonMobile;

  try {
    const params = { page, limit: LIMIT, sortBy: 'createdAt', order: activeFilters.order || 'desc', ...activeFilters };
    delete params.order;
    const data = await api.get('/inventory', params);
    if (!data) return;

    if (!data.products.length) {
      const emptyState = `<div class="w-full text-center py-16 text-gray-400">No products found matching your filters.</div>`;
      tbody.innerHTML = emptyState;
      if(mobileTbody) mobileTbody.innerHTML = emptyState;
      return;
    }

    let desktopHTML = '';
    let mobileHTML = '';

    data.products.forEach(p => {
        const threshold = p.lowStockThreshold || 5;
        const colors = getInventoryColors(p.stock, threshold);
        const badge = getStockBadge(p.stock, threshold);
        
        desktopHTML += `
        <!-- Desktop Row -->
        <div class="grid grid-cols-[50px_90px_minmax(150px,1fr)_120px_140px_90px_80px_100px_110px] w-full min-w-[1000px] h-[87px] ${colors.bgClass} ${colors.borderClass} rounded-[5px] items-center px-2 cursor-pointer hover:shadow-md transition" onclick="if (!event.target.closest('input')) window.location.href='products/add-product.html?id=${p._id}'" style="${colors.style}">
            <div class="flex items-center justify-center w-full">
                <input type="checkbox" class="inventory-row-checkbox bulk-cb w-[21px] h-[21px] min-w-[21px] border-[#9A9A9A] rounded-[3px] accent-[#BE2229] cursor-pointer" value="${p._id}" />
            </div>
            <div class="flex items-center justify-center w-full">
                <div class="w-[72px] h-[72px] flex items-center justify-center overflow-hidden shrink-0">
                    <img src="${imageUrl(p.images?.[0])}" class="max-w-[80%] max-h-[80%] object-contain block" alt="default" onerror="this.src='../assets/images/header.png'">
                </div>
            </div>
            <div class="font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-left pl-2 overflow-hidden text-ellipsis whitespace-nowrap w-full">${p.name.replace(/'/g, "&apos;").replace(/"/g, "&quot;")}</div>
            <div class="font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-center w-full">${p.sku || '—'}</div>
            <div class="font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-center w-full">${p.category?.name || '—'}</div>
            <div class="flex items-center justify-center w-full">
                <input type="number" data-id="${p._id}" data-original="${p.stock}" value="${p.stock}" class="stock-input bg-white border border-[#DADADA] rounded-[5px] px-[10px] py-[10px] font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-center min-w-[86px] w-[86px] outline-none focus:border-[#BE2229] transition" min="0" />
            </div>
            <div class="font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-center w-full">${p.batchNumber || '—'}</div>
            <div class="flex items-center justify-center w-full">
                ${badge}
            </div>
            <div class="font-['Roboto'] font-normal text-[17px] leading-[20px] text-[#000000] text-center w-full">${formatDateOnly(p.updatedAt)}</div>
        </div>`;

        mobileHTML += `
        <!-- Mobile Card -->
        <div class="rounded-[10px] box-shadow-card p-4 flex flex-col gap-4 border ${colors.borderClass} ${colors.bgClass} cursor-pointer hover:shadow-md transition" onclick="if (!event.target.closest('input')) window.location.href='products/add-product.html?id=${p._id}'" style="${colors.style}">
            <div class="flex items-center justify-between border-b pb-3 ${colors.mobileBorderOpacity}">
                <div class="flex items-center gap-3">
                    <input type="checkbox" class="inventory-row-checkbox bulk-cb w-[18px] h-[18px] accent-[#BE2229] cursor-pointer rounded" value="${p._id}">
                    <div class="w-[50px] h-[50px] rounded flex items-center justify-center overflow-hidden shrink-0">
                        <img src="${imageUrl(p.images?.[0])}" class="max-w-[80%] max-h-[80%] object-contain" alt="Product" onerror="this.src='../assets/images/header.png'">
                    </div>
                    <div>
                        <p class="font-['Roboto'] font-medium text-[16px] text-black w-[150px] truncate">${p.name.replace(/'/g, "&apos;").replace(/"/g, "&quot;")}</p>
                        <p class="font-['Roboto'] text-[13px] text-[#656565]">${p.sku || '—'}</p>
                    </div>
                </div>
                ${badge}
            </div>
            <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-[14px]">
                <div><span class="text-[#656565]">Sub-category:</span> <span class="text-black font-medium">${p.category?.name || '—'}</span></div>
                <div class="flex items-center gap-2"><span class="text-[#656565]">Stock:</span> <input type="number" data-id="${p._id}" data-original="${p.stock}" value="${p.stock}" class="stock-input bg-white border border-[#DADADA] rounded-[5px] px-2 py-1 font-['Roboto'] font-medium text-[14px] text-black text-center w-[70px] outline-none focus:border-[#BE2229] transition" min="0" /></div>
                <div><span class="text-[#656565]">Batch:</span> <span class="text-black font-medium">${p.batchNumber || '—'}</span></div>
                <div><span class="text-[#656565]">Last Updated:</span> <span class="text-black font-medium">${formatDateOnly(p.updatedAt)}</span></div>
            </div>
        </div>`;
    });

    tbody.innerHTML = desktopHTML;
    if(mobileTbody) mobileTbody.innerHTML = mobileHTML;

    buildPagination('inventory-pagination', page, data.pages || Math.ceil(data.total / LIMIT), (n) => loadInventory(n));
    if (document.getElementById('top-pagination')) {
        buildPagination('top-pagination', page, data.pages || Math.ceil(data.total / LIMIT), (n) => loadInventory(n), true);
    }
  } catch (err) {
    const errorState = `<div class="w-full text-center py-8 text-red-500">Error: ${err.message}</div>`;
    tbody.innerHTML = errorState;
    if(mobileTbody) mobileTbody.innerHTML = errorState;
  }
}

function getInventoryColors(stock, threshold) {
    if (stock <= 0) return {
        bgClass: '',
        style: 'background: linear-gradient(180deg, rgba(248, 88, 88, 0.66) 0%, rgba(255, 0, 0, 0.66) 100%);',
        borderClass: 'border border-[#BE2229]',
        mobileBorderOpacity: 'border-white/30'
    };
    if (stock <= threshold) return {
        bgClass: '',
        style: 'background: linear-gradient(180deg, rgba(255, 187, 139, 0.36) 0%, rgba(208, 122, 61, 0.36) 100%);',
        borderClass: 'border border-[#D07A3D]',
        mobileBorderOpacity: 'border-[#D07A3D]/30'
    };
    return {
        bgClass: 'bg-[#DBFFDE]',
        style: '',
        borderClass: 'border border-[#2F4D04]',
        mobileBorderOpacity: 'border-[#2F4D04]/30'
    };
}

function getStockBadge(stock, threshold) {
  if (stock <= 0) return `<span class="px-[10px] py-[5px] bg-[#BE2229] rounded-[100px] font-['Roboto'] font-normal text-[13px] sm:text-[15px] leading-[18px] text-white">Out of Stock</span>`;
  if (stock <= threshold) return `<span class="px-[10px] py-[5px] bg-[#FFBB8B] rounded-[100px] font-['Roboto'] font-normal text-[13px] sm:text-[15px] leading-[18px] text-[#A36014]">Low</span>`;
  return `<span class="px-[10px] py-[5px] bg-[#A2FFA8] rounded-[100px] font-['Roboto'] font-normal text-[13px] sm:text-[15px] leading-[18px] text-[#2F4D04]">In Stock</span>`;
}

function formatDateOnly(date) {
    if (!date) return '—';
    const d = new Date(date);
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

// ── Stock Update Modal ─────────────────────────────────────────────────────────────
function openStockModal(id, name, sku, stock) {
  activeProductId = id;
  setText('modal-name', name);
  setText('modal-sku', `SKU: ${sku || 'No SKU'}`);
  setText('modal-current-stock', stock);
  
  const modal = document.getElementById('stock-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  // Reset inputs
  document.getElementById('stock-qty-input').value = '';
  document.getElementById('stock-reason-input').value = '';
  setStockType('stock_in');
}

function closeStockModal() {
  const modal = document.getElementById('stock-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  activeProductId = null;
}

function setStockType(type) {
  activeStockType = type;
  ['btn-stock-in', 'btn-stock-out', 'btn-adjustment'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === `btn-${type.replace('_','-')}`) {
        el.className = "flex-1 py-2 rounded-lg border-2 border-green-500 bg-green-50 text-green-700 font-medium";
    } else {
        el.className = "flex-1 py-2 rounded-lg border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition";
    }
  });
}

async function updateStock() {
  if (!activeProductId) return;
  const qtyInput = document.getElementById('stock-qty-input');
  const reasonInput = document.getElementById('stock-reason-input');
  const qty = qtyInput.value;
  const reason = reasonInput.value;

  if (!qty || qty < 0) { showToast('Please enter a valid quantity', 'warning'); return; }

  const btn = document.getElementById('confirm-stock-btn');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    await api.put(`/inventory/${activeProductId}/stock`, {
      quantity: Number(qty),
      type: activeStockType,
      reason: reason || 'Manual update from inventory panel'
    });
    showToast('Stock updated successfully', 'success');
    closeStockModal();
    await loadInventory(currentPage);
    await loadInventoryStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Now';
  }
}

// ── Logs Modal ─────────────────────────────────────────────────────────────
async function viewLogs(id, name) {
    const modal = document.getElementById('logs-modal');
    const container = document.getElementById('logs-list');
    if (!modal || !container) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    container.innerHTML = `<div class="py-10 text-center animate-pulse">Loading history...</div>`;
    
    try {
        const data = await api.get(`/inventory/${id}/logs`);
        if (!data || !data.logs.length) {
            container.innerHTML = `<div class="py-10 text-center text-gray-400">No logs found for this product.</div>`;
            return;
        }
        
        container.innerHTML = data.logs.map(l => {
            const isAdd = l.type === 'stock_in';
            const isRemove = l.type === 'stock_out';
            const badgeClass = isAdd ? 'text-green-600' : isRemove ? 'text-red-600' : 'text-blue-600';
            const symbol = isAdd ? '+' : isRemove ? '-' : '=';
            
            return `
            <div class="p-3 border rounded-lg bg-gray-50/50 flex flex-col gap-1">
                <div class="flex justify-between items-start">
                    <span class="font-bold ${badgeClass}">${l.type.toUpperCase()} (${symbol}${l.quantity})</span>
                    <span class="text-xs text-gray-400">${formatDateTime(l.createdAt)}</span>
                </div>
                <div class="text-sm text-gray-600">Stock: ${l.previousStock} → ${l.newStock}</div>
                <div class="text-sm italic text-gray-500">"${l.reason || 'No reason provided'}"</div>
                <div class="text-[10px] text-right text-gray-400">By: ${l.updatedBy?.name || 'Admin'}</div>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="py-10 text-center text-red-500">Error: ${err.message}</div>`;
    }
}

function closeLogsModal() {
    const modal = document.getElementById('logs-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function bindInventoryEvents() {
  document.getElementById('inventory-search')?.addEventListener('input', (e) => {
    clearTimeout(window.searchTimer);
    window.searchTimer = setTimeout(() => {
        activeFilters.search = e.target.value.trim() || undefined;
        loadInventory(1);
    }, 500);
  });

  document.getElementById('stock-status-filter')?.addEventListener('change', e => {
      activeFilters.stockStatus = e.target.value || undefined;
      loadInventory(1);
  });

  document.getElementById('inventory-sort')?.addEventListener('change', e => {
      const val = e.target.value;
      if (val === 'stock-asc') { activeFilters.sortBy = 'stock'; activeFilters.order = 'asc'; }
      else if (val === 'stock-desc') { activeFilters.sortBy = 'stock'; activeFilters.order = 'desc'; }
      else if (val === 'name-asc') { activeFilters.sortBy = 'name'; activeFilters.order = 'asc'; }
      else { delete activeFilters.sortBy; delete activeFilters.order; }
      loadInventory(1);
  });

  document.getElementById('refresh-inventory')?.addEventListener('click', () => {
      loadInventoryStats(); loadInventory(1);
  });

  // View toggles
  document.getElementById('view-all')?.addEventListener('click', () => {
    activeFilters.isActive = true; loadInventory(1);
    document.getElementById('view-all').className = "font-['Poppins'] font-medium text-[18px] sm:text-[20px] leading-[30px] active-tab whitespace-nowrap";
    document.getElementById('view-hidden').className = "font-['Poppins'] font-medium text-[18px] sm:text-[20px] leading-[30px] text-[#A4A4A4] hover:text-[#000000] transition pb-1 whitespace-nowrap";
  });
  document.getElementById('view-hidden')?.addEventListener('click', () => {
    activeFilters.isActive = false; loadInventory(1);
    document.getElementById('view-hidden').className = "font-['Poppins'] font-medium text-[18px] sm:text-[20px] leading-[30px] active-tab whitespace-nowrap";
    document.getElementById('view-all').className = "font-['Poppins'] font-medium text-[18px] sm:text-[20px] leading-[30px] text-[#A4A4A4] hover:text-[#000000] transition pb-1 whitespace-nowrap";
  });

  // Bulk actions handling
  const selectAllCb = document.getElementById('select-all');
  const bulkBtn = document.getElementById('bulk-visibility-btn');
  const tbody = document.getElementById('inventory-tbody');

  selectAllCb?.addEventListener('change', (e) => {
    const cbs = tbody.querySelectorAll('.bulk-cb');
    cbs.forEach(cb => cb.checked = e.target.checked);
    bulkBtn.disabled = !e.target.checked;
  });

  tbody?.addEventListener('change', (e) => {
    if (e.target.classList.contains('bulk-cb')) {
      const allCbs = tbody.querySelectorAll('.bulk-cb');
      const anyChecked = Array.from(allCbs).some(cb => cb.checked);
      const allChecked = Array.from(allCbs).every(cb => cb.checked);
      bulkBtn.disabled = !anyChecked;
      if (selectAllCb) selectAllCb.checked = allChecked;
    }
  });

  bulkBtn?.addEventListener('click', async () => {
    const selected = Array.from(tbody.querySelectorAll('.bulk-cb:checked')).map(cb => cb.value);
    if (!selected.length) return;
    const isActivating = activeFilters.isActive === false;
    const action = isActivating ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} ${selected.length} products?`)) return;
    
    try {
      bulkBtn.disabled = true;
      await api.post('/products/bulk-status', { ids: selected, isActive: isActivating });
      showToast(`Successfully ${isActivating ? 'activated' : 'deactivated'} products`, 'success');
      loadInventory(currentPage);
      if (selectAllCb) selectAllCb.checked = false;
    } catch (err) {
      showToast('Bulk update failed: ' + err.message, 'error');
    } finally {
      bulkBtn.disabled = false;
    }
  });

  // Save changes button logic
  document.getElementById('save-inventory-btn')?.addEventListener('click', async () => {
      const inputs = Array.from(document.querySelectorAll('.stock-input'));
      const updates = inputs
          .map(input => ({ 
              productId: input.dataset.id, 
              quantity: Number(input.value), 
              type: 'adjustment',
              reason: 'Bulk stock table update',
              _original: Number(input.dataset.original) 
          }))
          .filter(item => item.quantity !== item._original);

      if (updates.length === 0) {
          showToast('No stock changes to save.', 'info');
          return;
      }
      
      const btn = document.getElementById('save-inventory-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
          await api.put('/inventory/bulk-update', { updates });
          showToast(`Successfully updated stock for ${updates.length} products.`, 'success');
          loadInventory(currentPage);
      } catch (err) {
          showToast('Error saving stock: ' + err.message, 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = 'Save Changes';
      }
  });
}
