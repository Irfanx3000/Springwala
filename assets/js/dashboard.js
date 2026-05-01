/**
 * dashboard.js
 * Matches: admin/dashboard.html
 * Pulls ALL data from backend. No demo data.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Secure page: Redirects to /admin/login.html if no valid session
  if (!Auth.requireAdminAuth()) return;
  initSidebar();
  initAdminHeader();

  // Load all sections in parallel
  await Promise.all([
    loadDashboardStats(),
    loadInventoryOverview(),
    loadRecentActivity(),
    loadRecentOrdersTable(),
    loadSalesAndCustomers(),
    initMainGraph(),
  ]);
});

// ── KPI Stat Cards ─────────────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const data = await api.get('/orders/stats');
    if (!data) return;

    setText('stat-revenue', formatCurrency(data.totalRevenue));
    setText('stat-orders', data.totalOrders.toLocaleString('en-IN'));
    setText('stat-users', data.totalCustomers.toLocaleString('en-IN'));
    setText('stat-pending-orders', data.pendingOrders.toLocaleString('en-IN'));
    setText('stat-aov', formatCurrency(data.averageOrderValue));
  } catch (err) {
    showToast('Dashboard stats error: ' + err.message, 'error');
  }
}

// ── Inventory Overview (High Stock / Low Stock / Top Selling) ─────────────────
async function loadInventoryOverview() {
  try {
    const [highRes, lowRes, topRes] = await Promise.all([
      api.get('/inventory', { stockStatus: 'in', limit: 4, sortBy: 'stock', order: 'desc' }),
      api.get('/inventory', { stockStatus: 'low', limit: 4, sortBy: 'stock', order: 'asc' }),
      api.get('/analytics/top-products', { range: '30d', limit: 4 }),
    ]);

    renderInvList('inv-high-stock', highRes?.products || [], p => `
      <div class="flex items-center justify-between px-3 py-2 border-b border-black/10 last:border-0 hover:bg-gray-50 transition min-h-[42px]">
        <span class="font-['Roboto'] text-[13px] text-[#1E1E1E] truncate flex-1">${p.name}</span>
        <span class="font-['Roboto'] text-[12px] text-green-700 font-semibold ml-2">${p.stock}</span>
      </div>`);

    renderInvList('inv-low-stock', lowRes?.products || [], p => `
      <div class="flex items-center justify-between px-3 py-2 border-b border-black/10 last:border-0 hover:bg-gray-50 transition min-h-[42px] ${p.stock === 0 ? 'bg-red-50/40' : ''}">
        <span class="font-['Roboto'] text-[13px] text-[#1E1E1E] truncate flex-1">${p.name}</span>
        <span class="font-['Roboto'] text-[12px] ${p.stock === 0 ? 'text-red-600' : 'text-yellow-600'} font-semibold ml-2">${p.stock}</span>
      </div>`);

    renderInvList('inv-top-selling', topRes?.data || [], p => `
      <div class="flex items-center justify-between px-3 py-2 border-b border-black/10 last:border-0 hover:bg-gray-50 transition min-h-[42px]">
        <span class="font-['Roboto'] text-[13px] text-[#1E1E1E] truncate flex-1">${p.name}</span>
        <span class="font-['Roboto'] text-[12px] text-[#BE2229] font-semibold ml-2">${p.totalSold} sold</span>
      </div>`);
  } catch (err) {
    console.error('Inventory overview error:', err.message);
  }
}

function renderInvList(id, items, renderFn) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-[13px] py-4">No data</div>`;
    return;
  }
  el.innerHTML = items.map(renderFn).join('');
}

// ── Recent Activity Feed ───────────────────────────────────────────────────────
async function loadRecentActivity() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  try {
    const [ordersRes, logsRes] = await Promise.all([
      api.get('/orders', { page: 1, limit: 5, sortBy: 'createdAt', order: 'desc' }),
      api.get('/inventory/logs', { page: 1, limit: 5 })
    ]);

    let activities = [];

    if (ordersRes?.orders) {
      activities.push(...ordersRes.orders.map(o => ({
        id: o._id,
        text: `${o.user?.name || o.customerName || 'Customer'} placed order ${o.orderNumber || o.orderId || o._id.slice(-6)}`,
        time: o.createdAt,
        type: 'order'
      })));
    }

    if (logsRes?.logs) {
      activities.push(...logsRes.logs.map(l => {
        let actionStr = 'updated stock for';
        if (l.type === 'stock_in') actionStr = 'added stock for';
        else if (l.type === 'stock_out') actionStr = 'reduced stock for';
        return {
          text: `Admin ${actionStr} ${l.product?.name || 'a product'}`,
          time: l.createdAt,
          type: 'inventory'
        };
      }));
    }

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    activities = activities.slice(0, 7); // Show a bit more since we combined them

    if (!activities.length) {
      feed.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-[13px] py-4">No recent activity</div>`;
      return;
    }

    feed.innerHTML = activities.map(a => `
      <div class="flex flex-col justify-center px-[10px] py-[3px] border-b border-[#B9B9B9] last:border-0 min-h-[42px] hover:bg-[#F2F2F2] transition cursor-pointer"
           onclick="window.location.href='${a.type === 'order' ? 'orders/order-detail.html?id=' + a.id : 'inventory.html'}'">
        <span class="font-['Roboto'] text-[14px] leading-[16px] text-[#1E1E1E] truncate w-full">${a.text}</span>
        <span class="font-['Roboto'] text-[10px] leading-[12px] text-[#656565] mt-[2px] w-full">${timeAgo(a.time)}</span>
      </div>`).join('');
  } catch (err) {
    if (feed) feed.innerHTML = `<div class="text-red-400 text-[12px] text-center py-4">${err.message}</div>`;
  }
}

// ── Quick Actions ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const actions = {
    'Add a Product': () => window.location.href = 'products/add-product.html',
    'Add a Category': () => window.location.href = 'categories.html',
    'Bulk Upload': () => window.location.href = 'products/bulk-upload.html',
    'Update Inventory': () => window.location.href = 'inventory.html',
    'Generate Report': async () => {
      try {
        await api.download('/orders/export/xlsx', `springwala-report-${Date.now()}.xlsx`);
        showToast('Report downloaded!', 'success');
      } catch (err) { showToast('Download failed', 'error'); }
    },
  };

  document.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fn = actions[btn.dataset.quickAction];
      if (fn) fn();
    });
  });
});

// ── Recent Orders Table (with Pagination) ─────────────────────────────────────
let currentOrdersPage = 1;
const ordersLimit = 10;

async function loadRecentOrdersTable(page = 1) {
  const tbody = document.getElementById('recent-orders-tbody');
  const prevBtn = document.getElementById('prev-orders-btn');
  const nextBtn = document.getElementById('next-orders-btn');
  const paginText = document.getElementById('orders-pagination-text');
  
  if (!tbody) return;
  currentOrdersPage = page;

  try {
    const data = await api.get('/orders', { page, limit: ordersLimit, sortBy: 'createdAt', order: 'desc' });
    
    if (!data?.orders?.length) {
      tbody.innerHTML = `<div class="text-center py-20 text-gray-400 text-sm">No orders yet. <a href="orders.html" class="text-[#BE2229] hover:underline font-bold">View all orders →</a></div>`;
      if (paginText) paginText.textContent = '0–0 of 0';
      return;
    }

    tbody.innerHTML = data.orders.map(o => `
      <div class="w-full bg-white min-h-[58px] border-b border-[#B9B9B9] last:border-0 px-[20px] lg:px-[53px] grid grid-cols-[100px_160px_230px_130px_160px_100px] gap-4 justify-between hover:bg-red-50/30 transition-all cursor-pointer group"
           onclick="window.location.href='orders/order-detail.html?id=${o._id}'">
        <div class="flex items-center"><span class="font-['Roboto'] font-bold text-[16px] text-gray-900 group-hover:text-[#BE2229] transition-colors">#${o.orderNumber || o.orderId || o._id.slice(-6)}</span></div>
        <div class="flex items-center"><span class="font-['Roboto'] text-[15px] text-[#363636] truncate">${o.user?.name || o.customerName || 'N/A'}</span></div>
        <div class="flex items-center"><span class="font-['Roboto'] text-[15px] text-gray-500 truncate italic">${o.items?.[0]?.name || '—'}</span></div>
        <div class="flex items-center justify-center">${orderStatusBadge(o.orderStatus)}</div>
        <div class="flex items-center justify-center">${paymentStatusBadge(o.paymentStatus)}</div>
        <div class="flex items-center justify-end pr-3"><span class="font-['Roboto'] font-bold text-[16px] text-gray-900">${formatCurrency(o.totalAmount)}</span></div>
      </div>`).join('');

    // Update Pagination UI
    const start = (page - 1) * ordersLimit + 1;
    const end = Math.min(page * ordersLimit, data.total);
    if (paginText) paginText.textContent = `${start}–${end} of ${data.total}`;
    
    if (prevBtn) prevBtn.disabled = page === 1;
    if (nextBtn) nextBtn.disabled = end >= data.total;

  } catch (err) {
    if (tbody) tbody.innerHTML = `<div class="text-center py-10 text-red-500 text-sm font-bold">Failed to load orders: ${err.message}</div>`;
  }
}

// Bind Pagination Events
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prev-orders-btn')?.addEventListener('click', () => {
        if (currentOrdersPage > 1) loadRecentOrdersTable(currentOrdersPage - 1);
    });
    document.getElementById('next-orders-btn')?.addEventListener('click', () => {
        loadRecentOrdersTable(currentOrdersPage + 1);
    });
});

// ── Sales and Customers ────────────────────────────────────────────────────────
async function loadSalesAndCustomers() {
  try {
    const [salesRes, topRes] = await Promise.all([
      api.get('/analytics/sales-by-category', { range: '30d' }),
      api.get('/analytics/top-customers', { limit: 10 }),
    ]);

    const salesEl = document.getElementById('dashboard-sales-by-cat');
    if (salesEl) {
      if (!salesRes?.data?.length) {
        salesEl.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-[13px] py-4">No data available</div>`;
      } else {
        salesEl.innerHTML = salesRes.data.map(c => `
          <div class="flex items-center justify-between px-4 py-2 border-b border-[#E9E9E9] hover:bg-red-50 transition min-h-[42px] last:border-0">
            <span class="font-['Roboto'] text-[13px] text-[#1E1E1E] truncate flex-1">${c.name}</span>
            <span class="font-['Roboto'] text-[12px] font-bold text-[#BE2229]">${c.totalSold} sold</span>
          </div>
        `).join('');
      }
    }

    const custEl = document.getElementById('dashboard-top-customers');
    if (custEl) {
      if (!topRes?.data?.length) {
        custEl.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-[13px] py-4">No data available</div>`;
      } else {
        custEl.innerHTML = topRes.data.map(c => `
          <div class="flex items-center justify-between px-4 py-2 border-b border-[#E9E9E9] hover:bg-red-50 transition min-h-[42px] last:border-0">
            <div class="flex flex-col flex-1 overflow-hidden">
                <span class="font-['Roboto'] text-[13px] text-[#1E1E1E] truncate w-full">${c.name}</span>
                <span class="font-['Roboto'] text-[11px] text-[#656565] truncate w-full">${c.totalOrders} order(s)</span>
            </div>
            <span class="font-['Roboto'] text-[12px] text-gray-900 font-bold whitespace-nowrap ml-2">${formatCurrency(c.totalSpent)}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading sales and customers:', err);
  }
}

// ── Main Analytics Graph Logic ──────────────────────────────────────────────────
let mainChart = null;
let currentMetric = 'revenue';
let currentRange = '30d';

async function initMainGraph() {
  const metricTabs = document.querySelectorAll('.metric-tab');
  const rangeFilters = document.querySelectorAll('.range-filter');

  // Tab switching logic
  metricTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      metricTabs.forEach(t => {
        t.classList.remove('active', 'bg-white', 'text-[#BE2229]', 'shadow-sm');
        t.classList.add('text-gray-500');
      });
      tab.classList.add('active', 'bg-white', 'text-[#BE2229]', 'shadow-sm');
      tab.classList.remove('text-gray-500');
      currentMetric = tab.dataset.metric;
      updateGraphTitle();
      loadGraphData();
    });
  });

  // Range filtering logic
  rangeFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      rangeFilters.forEach(f => {
        f.classList.remove('active', 'bg-[#BE2229]', 'text-white', 'shadow-sm');
        f.classList.add('text-gray-500');
      });
      filter.classList.add('active', 'bg-[#BE2229]', 'text-white', 'shadow-sm');
      filter.classList.remove('text-gray-500');
      currentRange = filter.dataset.range;
      loadGraphData();
    });
  });

  // Initial Load
  await loadGraphData();
}

function updateGraphTitle() {
  const titles = { revenue: 'Revenue Growth', orders: 'Order Volume', customers: 'Customer Growth', aov: 'Average Order Value' };
  setText('graph-title', titles[currentMetric] || 'Analytics');
}

async function loadGraphData() {
  const ctx = document.getElementById('main-analytics-chart');
  const emptyState = document.getElementById('graph-empty-state');
  if (!ctx) return;

  try {
    let endpoint = '/analytics/revenue';
    if (currentMetric === 'customers') endpoint = '/analytics/user-growth';
    
    const res = await api.get(endpoint, { range: currentRange });
    if (!res || !res.success || !res.data || res.data.length === 0) {
      emptyState.classList.remove('hidden');
      if (mainChart) mainChart.destroy();
      mainChart = null;
      return;
    }

    emptyState.classList.add('hidden');
    renderChart(res.data);
  } catch (err) {
    console.error('Graph data error:', err);
    emptyState.classList.remove('hidden');
  }
}

function renderChart(rawData) {
  const ctx = document.getElementById('main-analytics-chart').getContext('2d');
  
  // Prepare data based on metric
  let labels = [];
  let dataPoints = [];
  let total = 0;

  if (currentMetric === 'customers') {
    labels = rawData.map(d => d._id);
    dataPoints = rawData.map(d => d.newUsers);
    total = dataPoints.reduce((a, b) => a + b, 0);
  } else if (currentMetric === 'aov') {
    labels = rawData.map(d => d._id);
    dataPoints = rawData.map(d => d.orders > 0 ? d.revenue / d.orders : 0);
    total = dataPoints.length ? dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length : 0;
  } else {
    labels = rawData.map(d => d._id);
    dataPoints = rawData.map(d => currentMetric === 'revenue' ? d.revenue : d.orders);
    total = dataPoints.reduce((a, b) => a + b, 0);
  }

  // Update Period Total
  const totalEl = document.getElementById('graph-period-total');
  if (totalEl) {
    if (currentMetric === 'revenue' || currentMetric === 'aov') totalEl.textContent = formatCurrency(total);
    else totalEl.textContent = total.toLocaleString('en-IN');
  }

  // Calculate Growth (vs first point in period)
  const growthEl = document.getElementById('graph-growth');
  if (growthEl && dataPoints.length > 1) {
    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const change = first !== 0 ? ((last - first) / first) * 100 : 0;
    const isPos = change >= 0;
    growthEl.textContent = `${isPos ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`;
    growthEl.className = `px-2 py-0.5 rounded-full text-[12px] font-bold border ${isPos ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`;
  }

  // Find Peak and Bottom (for focal highlights)
  const dataLen = dataPoints.length;

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(190, 34, 41, 0.25)');
  gradient.addColorStop(1, 'rgba(190, 34, 41, 0)');

  const chartConfig = {
    type: 'line',
    data: {
      labels: labels.map(l => formatDateShort(l)),
      datasets: [{
        label: currentMetric.toUpperCase(),
        data: dataPoints,
        borderColor: '#BE2229',
        borderWidth: 4,
        pointBackgroundColor: dataPoints.map((v, i) => (i === dataLen - 1) ? '#BE2229' : '#fff'),
        pointBorderColor: '#BE2229',
        pointBorderWidth: dataPoints.map((v, i) => (i === dataLen - 1) ? 4 : 2),
        pointRadius: dataPoints.map((v, i) => (i === dataLen - 1) ? 6 : 0), // Show ONLY latest point or on hover
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#BE2229',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
        tension: 0.45,
        fill: true,
        backgroundColor: gradient,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b', // Dark background for premium look
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 14,
          cornerRadius: 10,
          displayColors: false,
          titleFont: { family: 'Poppins', size: 13, weight: '600' },
          bodyFont: { family: 'Inter', size: 12 },
          callbacks: {
            label: (context) => {
              const val = context.parsed.y;
              let label = currentMetric === 'revenue' || currentMetric === 'aov' ? formatCurrency(val) : val.toLocaleString('en-IN');
              
              const idx = context.dataIndex;
              if (idx > 0) {
                const prev = dataPoints[idx - 1];
                const diff = prev !== 0 ? ((val - prev) / prev) * 100 : 0;
                label += `  ${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}% from prev`;
              }
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
          ticks: {
            padding: 10,
            font: { family: 'Inter', size: 11, weight: '500' },
            color: '#94a3b8',
            callback: (val) => currentMetric === 'revenue' || currentMetric === 'aov' ? compactCurrency(val) : compactNumber(val)
          }
        },
        x: {
          grid: { display: false },
          ticks: { 
            padding: 10,
            font: { family: 'Inter', size: 11, weight: '500' }, 
            color: '#94a3b8',
            maxRotation: 0 
          }
        }
      },
      interaction: { intersect: false, mode: 'index' },
    }
  };

  if (mainChart) {
    mainChart.data = chartConfig.data;
    mainChart.options = chartConfig.options;
    mainChart.update(); 
  } else {
    mainChart = new Chart(ctx, chartConfig);
  }
}

// ── Utility Helpers ────────────────────────────────────────────────────────────
function formatDateShort(d) {
  const date = new Date(d);
  if (currentRange === '1y') return date.toLocaleDateString('en-IN', { month: 'short' });
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function compactCurrency(n) {
  if (n >= 1000000) return '₹' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n;
}

function compactNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
}

