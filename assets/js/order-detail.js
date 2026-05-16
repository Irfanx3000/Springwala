/**
 * order-detail.js — Single order view + status update
 * Place at: assets/js/order-detail.js
 * Used by: admin/orders/order-detail.html?id=<orderId>
 *
 * Add before </body>:
 *   <script src="../../assets/js/api.js"></script>
 *   <script src="../../assets/js/order-detail.js"></script>
 *
 * Required IDs (fill these in your HTML):
 *   detail-order-id, detail-customer-name, detail-customer-email,
 *   detail-customer-phone, detail-order-date, detail-order-status,
 *   detail-payment-status, detail-payment-method, detail-tracking-number,
 *   detail-courier, detail-subtotal, detail-shipping, detail-discount,
 *   detail-total, detail-address, detail-items-tbody,
 *   update-status-form, status-select, payment-status-select,
 *   tracking-input, courier-input, note-input, update-btn,
 *   status-history-list
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initAdminHeader();

  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) { showToast('Invalid order ID', 'error'); return; }

  await loadOrderDetail(orderId);
  bindUpdateForm(orderId);
});

async function loadOrderDetail(orderId) {
  try {
    const data = await api.get(`/orders/${orderId}`);
    if (!data) return;
    const { order } = data;

    // Basic info
    setText('detail-order-id', order.orderNumber || order.orderId || order._id);
    setText('detail-order-date', formatDateTime(order.createdAt));
    setText('detail-customer-name', order.customerName || (order.user ? `${order.user.firstName} ${order.user.lastName || ''}`.trim() : 'N/A'));
    setText('detail-customer-email', order.user?.email || 'N/A');
    setText('detail-customer-phone', order.user?.phoneNumber || order.user?.phone || 'N/A');

    // Status badges
    const statusEl = document.getElementById('detail-order-status');
    if (statusEl) statusEl.innerHTML = orderStatusBadge(order.orderStatus);
    const payEl = document.getElementById('detail-payment-status');
    if (payEl) payEl.innerHTML = paymentStatusBadge(order.paymentStatus);

    setText('detail-payment-method', order.paymentMethod);
    setText('detail-tracking-number', order.trackingNumber || order.orderNumber);
    setText('detail-courier', 'Manual Fulfillment');

    // Financials (ORDER-SYNC: Use totalAmount as Grand Total SSOT)
    const grandTotal = Number(order.totalAmount || order.finalAmount || 0);
    
    setText('detail-subtotal', formatCurrency(order.subtotal || 0));
    setText('detail-shipping', formatCurrency(order.shippingCharge || order.deliveryCharges || 0));
    setText('detail-discount', formatCurrency(order.discount || 0));
    setText('detail-total', formatCurrency(grandTotal));

    console.log('[ORDER-SYNC] Admin Detail Financial Snapshot:', {
      subtotal: order.subtotal,
      shipping: order.shippingCharge,
      grandTotal: grandTotal
    });

    // Shipping address
    const addr = order.shippingAddress;
    const addrEl = document.getElementById('detail-address');
    if (addrEl && addr) {
      addrEl.innerHTML = `
        <p class="font-semibold">${addr.fullName}</p>
        <p>${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}</p>
        <p>${addr.city}, ${addr.state} - ${addr.pincode}</p>
        <p>${addr.country}</p>
        <p class="mt-1">📞 ${addr.phone}</p>`;
    }

    // Items
    const itemsTbody = document.getElementById('detail-items-tbody');
    if (itemsTbody) {
      itemsTbody.innerHTML = order.items.map(item => `
        <tr class="border-b border-gray-100">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              ${item.product?.images?.[0] ? `<img src="${imageUrl(item.product.images[0])}" class="w-10 h-10 rounded object-cover" alt="${item.name}">` : '<div class="w-10 h-10 bg-gray-100 rounded"></div>'}
              <span class="font-['Roboto'] text-[15px]">${item.name}${item.variant ? ` <span class="text-gray-400">(${item.variant.name}: ${item.variant.value})</span>` : ''}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-center">${formatCurrency(item.discountedPrice || item.price)}</td>
          <td class="px-4 py-3 text-center">${item.quantity}</td>
          <td class="px-4 py-3 text-right">${formatCurrency((item.discountedPrice || item.price) * item.quantity)}</td>
        </tr>`).join('');
    }

    // Pre-fill update form (ORDER-SYNC: Autofill Tracking Reference)
    const statusSelect = document.getElementById('status-select');
    const paySelect = document.getElementById('payment-status-select');
    const trackingInput = document.getElementById('tracking-input');
    const courierInput = document.getElementById('courier-input');
    
    if (statusSelect) statusSelect.value = order.orderStatus;
    if (paySelect) paySelect.value = order.paymentStatus;
    
    if (trackingInput) {
      // SSOT: Priority is always internal Tracking Number
      trackingInput.value = order.trackingNumber || order.orderNumber || '';
    }
    
    if (courierInput) {
      courierInput.value = order.courier || 'Manual Fulfillment';
    }

    // Status history
    const historyEl = document.getElementById('status-history-list');
    if (historyEl && order.statusHistory?.length) {
      historyEl.innerHTML = order.statusHistory.slice().reverse().map(h => `
        <div class="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
          <div class="w-2 h-2 rounded-full bg-[#BE2229] mt-2 shrink-0"></div>
          <div>
            <p class="font-['Roboto'] text-[15px] font-medium">${h.status}</p>
            ${h.note ? `<p class="text-[13px] text-gray-500">${h.note}</p>` : ''}
            <p class="text-[12px] text-gray-400">${formatDateTime(h.updatedAt)} ${h.updatedBy ? '· ' + h.updatedBy : ''}</p>
          </div>
        </div>`).join('');
    } else if (historyEl) {
      historyEl.innerHTML = '<p class="text-gray-400 text-sm">No status history yet</p>';
    }

    // Delhivery Logistics Section
    handleLogisticsUI(order);

  } catch (err) {
    showToast('Failed to load order: ' + err.message, 'error');
  }
}

async function handleLogisticsUI(order) {
  const activeBox = document.getElementById('shipment-active');
  const emptyBox = document.getElementById('shipment-empty');
  
  if (!activeBox || !emptyBox) return;

  const trackingId = order.trackingNumber;

  if (trackingId) {
    activeBox.classList.remove('hidden');
    emptyBox.classList.add('hidden');
    
    setText('shipment-waybill', trackingId);
    setText('shipment-live-status', 'Manual Tracking Active');
    
    if (order.shipmentCreatedAt || order.createdAt) {
      setText('shipment-created-at', formatDateTime(order.shipmentCreatedAt || order.createdAt));
    }

    const trackBtn = document.getElementById('shipment-track-btn');
    if (trackBtn) trackBtn.href = `../../track-order.html?trackingId=${trackingId}`;
    
    // Hide sync button in manual mode
    const syncBtn = document.getElementById('shipment-sync-btn');
    if (syncBtn) syncBtn.classList.add('hidden');

    /* ─── TEMPORARILY DISABLED: LIVE COURIER SYNC ───
    if (order.waybill || order.awb) {
       await syncLiveTracking(order.waybill || order.awb);
    }
    */
  } else {
    activeBox.classList.add('hidden');
    emptyBox.classList.remove('hidden');
    
    /* ─── TEMPORARILY DISABLED: DELHIERY CREATION ───
    const createBtn = document.getElementById('shipment-create-btn');
    const createHint = document.getElementById('shipment-create-hint');
    if (createBtn) createBtn.classList.add('hidden');
    if (createHint) createHint.textContent = "Manual fulfillment mode is active. Internal tracking numbers are managed via the update form below.";
    */
  }
}

/* ─── COMMENTED OUT: DELHIERY SYNC LOGIC ───
async function syncLiveTracking(waybill, showToastMsg = false, btn = null) { ... }
*/

function bindUpdateForm(orderId) {
  const updateBtn = document.getElementById('update-btn');
  if (!updateBtn) return;

  updateBtn.addEventListener('click', async () => {
    const body = {
      orderStatus: document.getElementById('status-select')?.value,
      paymentStatus: document.getElementById('payment-status-select')?.value,
      trackingNumber: document.getElementById('tracking-input')?.value?.trim(),
      courier: document.getElementById('courier-input')?.value?.trim(),
      note: document.getElementById('note-input')?.value?.trim(),
      cancelReason: document.getElementById('cancel-reason-input')?.value?.trim(),
    };

    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    try {
      await api.put(`/orders/${orderId}/status`, body);
      showToast('Order updated successfully', 'success');
      await loadOrderDetail(orderId);
    } catch (err) {
      showToast('Update failed: ' + err.message, 'error');
    } finally {
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Order';
    }
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
