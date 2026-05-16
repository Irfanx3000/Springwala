/**
 * orders.js
 * Matches: admin/orders.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAdminAuth()) return;
  initSidebar();
  initAdminHeader();
  await loadOrderStats();
  await loadOrders(1);
  bindOrderEvents();
});

let currentOrderPage = 1;
let orderFilters = {};
const ORDER_LIMIT = 10;

async function loadOrderStats() {
  try {
    const data = await api.get('/orders/stats');
    if (!data) return;

    setText('stat-total-orders', data.totalOrders);
    setText('stat-orders-month', data.ordersThisMonth);
    setText('stat-pending-orders', data.pendingOrders);
    setText('stat-completed-orders', data.completedOrders);
  } catch (err) { console.error('Stats error:', err.message); }
}

async function loadOrders(page = 1) {
  currentOrderPage = page;
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  tbody.innerHTML = Array(6).fill(`<tr class="h-[58px]">${Array(7).fill('<td class="px-6 py-3"><div class="h-4 bg-gray-100 rounded animate-pulse"></div></td>').join('')}</tr>`).join('');

  try {
    const params = {
      page,
      limit: ORDER_LIMIT,
      sortBy: 'createdAt',
      order: orderFilters.order || 'desc',
      ...orderFilters
    };
    // Backend expects 'order' separately if we use it in api.get, 
    // but our api.get implementation already handles params.

    const data = await api.get('/orders', params);
    if (!data) return;

    if (!data.orders.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-16 text-gray-400">No orders found matching your filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders.map(o => `
      <tr class="h-[58px] hover:bg-gray-50 transition border-b border-[#B9B9B9] last:border-0 cursor-pointer" 
          onclick="window.location.href='orders/order-detail.html?id=${o._id}'">
        <td class="px-6 font-['Roboto'] text-[17px]">${o.orderNumber || o.orderId || o._id}</td>
        <td class="px-6 font-['Roboto'] text-[17px]">${o.user?.name || o.customerName || "N/A"}</td>
        <td class="px-6 font-['Roboto'] text-[17px]">${new Date(o.createdAt).toLocaleDateString()}</td>
        <td class="px-6 font-['Roboto'] text-[17px] truncate max-w-[200px]">
          ${o.items?.[0]?.product?.name || o.items?.[0]?.name || "N/A"}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}
        </td>
        <td class="px-6">
          <div class="flex flex-col gap-1">
            ${renderStatusBadge(o.orderStatus)}
            ${o.trackingNumber ? `<span class="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Ref: ${o.trackingNumber}</span>` : ''}
          </div>
        </td>
        <td class="px-6">${renderPaymentBadge(o.paymentStatus)}</td>
        <td class="px-6 font-['Roboto'] text-[17px]">
          <div class="flex flex-col">
            <span>₹${o.totalAmount.toFixed(2)}</span>
            ${o.trackingNumber ? `<a href="../track-order.html?trackingId=${o.trackingNumber}" target="_blank" class="text-[12px] text-[#BE2229] hover:underline font-bold" onclick="event.stopPropagation()">Track Order</a>` : ''}
          </div>
        </td>
      </tr>`).join('');

    buildPagination('orders-pagination', page, data.pages || Math.ceil(data.total / ORDER_LIMIT), (n) => loadOrders(n));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-500 text-[14px]">Error: ${err.message}</td></tr>`;
  }
}

function renderStatusBadge(status) {
  const map = {
    Ordered: "pill-ordered",
    Delivered: "pill-completed",
    Completed: "pill-completed",
    Pending: "pill-pending",
    Cancelled: "pill-cancelled",
    Processing: "pill-ordered",
    Shipped: "pill-ordered"
  };
  return `<span class="${map[status] || 'pill-pending'}">${status}</span>`;
}

function renderPaymentBadge(status) {
  return status === "Completed"
    ? `<span class="pill-completed">Completed</span>`
    : `<span class="pill-pending">${status || 'Pending'}</span>`;
}

function bindOrderEvents() {
  const searchEl = document.getElementById('order-search');
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { orderFilters.search = searchEl.value.trim() || undefined; loadOrders(1); }, 400);
    });
  }

  document.getElementById('order-status-filter')?.addEventListener('change', e => {
    orderFilters.orderStatus = e.target.value || undefined; loadOrders(1);
  });

  document.getElementById('order-sort')?.addEventListener('change', e => {
    orderFilters.order = e.target.value; loadOrders(1);
  });

  document.getElementById('refresh-orders')?.addEventListener('click', () => {
    loadOrderStats();
    loadOrders(1);
  });
}
