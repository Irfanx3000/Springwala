/**
 * orders.js
 * Frontend logic for the My Orders page.
 */

// initOrdersPage is called by app.js when body[data-page="orders"] is detected
async function initOrdersPage() {
    // 1. AUTHENTICATION FLOW
    if (!Auth.isLoggedIn()) {
        localStorage.setItem("redirectAfterLogin", window.location.href);
        window.location.href = 'login.html';
        return;
    }

    const container = document.getElementById('orders-container');
    const mobileContainer = document.getElementById('mobile-orders-container');

    if (!container && !mobileContainer) return;

    // Show loading state
    const loader = '<div class="flex justify-center py-20"><div class="animate-spin w-10 h-10 border-4 border-[#BE2229] border-t-transparent rounded-full"></div></div>';
    if (container) container.innerHTML = loader;
    if (mobileContainer) mobileContainer.innerHTML = loader;

    try {
        // 2. FETCH ORDERS DATA
        const data = await apiCall('/user/orders', 'GET', null, true);
        const orders = data.orders || [];

        if (orders.length === 0) {
            renderEmptyState();
        } else {
            // 5. STATUS SEGREGATION
            const undelivered = orders.filter(o =>
                ['pending', 'processing', 'shipped', 'ordered'].includes(o.orderStatus?.toLowerCase())
            );
            const delivered = orders.filter(o =>
                ['delivered', 'completed'].includes(o.orderStatus?.toLowerCase())
            );

            // Desktop Tab Logic
            renderDesktopOrders(undelivered); // Default tab
            setupTabs(undelivered, delivered);

            // Mobile Section Logic (Show both)
            renderMobileOrders(undelivered, delivered);
        }

        // 10. RELATED PRODUCTS
        await loadRelatedProducts();

    } catch (err) {
        console.error('Failed to load orders:', err);
        const errorUI = `<div class="text-center py-10 text-red-500">Failed to load orders. Please try again later.</div>`;
        if (container) container.innerHTML = errorUI;
        if (mobileContainer) mobileContainer.innerHTML = errorUI;
    }
}

function renderDesktopOrders(orders) {
    const container = document.getElementById('orders-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-gray-500 bg-white rounded-lg border border-gray-200">No orders found in this category.</div>`;
        return;
    }

    let html = '';
    orders.forEach(order => {
        order.items.forEach(item => {
            html += buildDesktopOrderCard(order, item);
        });
    });
    container.innerHTML = html;
}

function renderMobileOrders(undelivered, delivered) {
    const container = document.getElementById('mobile-orders-container');
    if (!container) return;

    let html = '';

    // Undelivered Section
    html += `
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-[#1E1E1E] text-[20px] font-semibold font-['Poppins']">Undelivered</h2>
            <span class="text-[#000000] text-[18px] font-normal font-['Roboto'] flex items-end">(${undelivered.length} Items)</span>
        </div>
        <div class="flex flex-col gap-4 mb-8">
            ${undelivered.length > 0
            ? undelivered.flatMap(o => o.items.map(i => buildMobileOrderCard(o, i))).join('')
            : '<div class="text-center py-4 text-gray-400 bg-white rounded-lg border border-gray-100">No undelivered items</div>'}
        </div>
        <div class="w-full h-[1px] border-b border-[rgba(0,0,0,0.14)] mb-8"></div>
    `;

    // Delivered Section
    html += `
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-[#1E1E1E] text-[20px] font-semibold font-['Poppins']">Delivered</h2>
            <span class="text-[#000000] text-[18px] font-normal font-['Roboto'] flex items-end">(${delivered.length} Items)</span>
        </div>
        <div class="flex flex-col gap-4">
            ${delivered.length > 0
            ? delivered.flatMap(o => o.items.map(i => buildMobileOrderCard(o, i))).join('')
            : '<div class="text-center py-4 text-gray-400 bg-white rounded-lg border border-gray-100">No delivered items</div>'}
        </div>
    `;

    container.innerHTML = html;
}

function buildDesktopOrderCard(order, item) {
    const product = item.product || {};
    const title = product.name || 'Product Name';
    const image = productImg(product);
    const price = formatCurrency(item.price * item.quantity);
    const dateStr = formatDate(order.orderStatus?.toLowerCase() === 'delivered' ? order.deliveryDate : (order.estimatedDeliveryDate || order.createdAt));
    const statusLabel = order.orderStatus?.toLowerCase() === 'delivered' ? 'Delivered on' : 'Estimated Delivery by';
    const statusColor = order.orderStatus?.toLowerCase() === 'delivered' ? '#096709' : '#1B99B5';

    return `
        <div class="w-full bg-white border border-[#E4E4E4] rounded-[10px] p-[20px] mb-[20px]">
            <div class="flex gap-[20px]">
                <div class="w-[141px] h-[141px] flex-shrink-0 flex items-center justify-center">
                    <img src="${image}" alt="${title}" class="max-w-full max-h-full object-contain" onerror="this.src='assets/images/deafult.png'">
                </div>
                <div class="flex-1 relative min-w-0 h-[141px]">
                    <div class="flex justify-between w-full h-[100px]">
                        <div class="flex flex-col items-start pr-[20px] flex-1">
                            <h3 class="text-[#000000] text-[20px] font-medium font-['Poppins'] leading-[28px] max-w-full line-clamp-2">${title}</h3>
                            <div class="inline-flex items-center px-[6px] py-[2px] rounded-[2px] mt-[8px]" style="background-color: ${statusColor}">
                                <span class="text-white text-[13px] font-medium font-['Poppins'] leading-[20px]">${statusLabel} ${dateStr}</span>
                            </div>
                        </div>
                        <div class="flex flex-col items-end flex-shrink-0 min-w-[120px]">
                            <button class="text-[#605454] hover:text-[#333] mb-[14px] mt-[4px]" onclick="shareOrder('${order._id}')">
                                <img src="assets/icons/desktop/share.svg" alt="Share" class="w-[18px] h-[18px]">
                            </button>
                            <div class="flex flex-col items-end justify-center">
                                <span class="text-[#000000] text-[26px] font-bold font-['Roboto'] leading-[30px]">${price}</span>
                                <a href="order-success.html?id=${order._id}" class="text-[#605D5D] text-[14px] font-medium font-['Poppins'] underline leading-[20px]">Order Details</a>
                            </div>
                        </div>
                    </div>
                    <div class="absolute bottom-0 left-0 w-full flex justify-between items-end">
                        <div class="flex flex-col gap-2">
                             ${order.waybill || order.awb ? `<div class="flex items-center gap-2"><span class="text-[11px] text-gray-400 uppercase font-bold tracking-widest">Delhivery</span> <span class="bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded border border-blue-100">${order.shipmentStatus || 'Manifested'}</span></div>` : ''}
                            <div class="flex gap-[16px]">
                                <button onclick="handleTracking('${order.waybill || order.awb || ''}', '${order._id}')" class="bg-[#E6E6E6] border border-[#C5C5C5] rounded-[3px] px-[14px] py-[5px] hover:bg-[#d5d5d5] hover:border-[#999] transition">
                                    <span class="text-[#333333] text-[14px] font-normal font-['Roboto']">Track Order</span>
                                </button>
                                <button onclick="contactSupport()" class="bg-[#E6E6E6] border border-[#C5C5C5] rounded-[3px] px-[14px] py-[5px] hover:bg-[#d5d5d5] hover:border-[#999] transition">
                                    <span class="text-[#333333] text-[14px] font-normal font-['Roboto']">Customer Support</span>
                                </button>
                                ${order.invoiceUrl ? `<button onclick="window.open('${order.invoiceUrl}')" class="bg-[#E6E6E6] border border-[#C5C5C5] rounded-[3px] px-[14px] py-[5px] hover:bg-[#d5d5d5] hover:border-[#999] transition">
                                    <span class="text-[#333333] text-[14px] font-normal font-['Roboto']">View Invoice</span>
                                </button>` : ''}
                            </div>
                        </div>
                        <button onclick="orderAgain('${product._id}')" class="bg-[#E6E6E6] border border-[#C5C5C5] rounded-[3px] px-[14px] py-[5px] hover:bg-[#d5d5d5] hover:border-[#999] transition">
                            <span class="text-[#333333] text-[14px] font-normal font-['Roboto']">Order Again</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildMobileOrderCard(order, item) {
    const product = item.product || {};
    const title = product.name || 'Product Name';
    const image = productImg(product);
    const dateStr = formatDate(order.orderStatus?.toLowerCase() === 'delivered' ? order.deliveryDate : (order.estimatedDeliveryDate || order.createdAt));
    const statusLabel = order.orderStatus?.toLowerCase() === 'delivered' ? 'Delivered on' : 'Estimated Delivery by';
    const statusColor = order.orderStatus?.toLowerCase() === 'delivered' ? '#096709' : '#1B99B5';

    return `
        <div class="w-full bg-white border border-[#E4E4E4] rounded-[10px] p-[16px]">
            <div class="flex items-start gap-[12px] mb-[12px]">
                <div class="w-[64px] h-[64px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src="${image}" alt="${title}" class="max-w-full max-h-full object-contain" onerror="this.src='assets/images/deafult.png'">
                </div>
                <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="text-[#000000] text-[15px] font-medium font-['Poppins'] leading-[22px] line-clamp-2">${title}</h3>
                        <button class="text-[#605454] flex-shrink-0 mt-[2px]" onclick="shareOrder('${order._id}')"><img src="assets/icons/mobile/share.svg" alt="Share" class="w-[16px] h-[16px]"></button>
                    </div>
                    <div class="inline-flex items-center px-[6px] py-[2px] rounded-[2px] w-fit mt-[4px]" style="background-color: ${statusColor}">
                        <span class="text-white text-[10px] font-medium font-['Poppins'] leading-[15px]">${statusLabel} ${dateStr}</span>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                ${order.waybill || order.awb ? `<div class="flex items-center gap-2 mb-2"><span class="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Delhivery</span> <span class="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">${order.shipmentStatus || 'Manifested'}</span></div>` : ''}
                <div class="flex items-center justify-start gap-[8px] w-full overflow-x-auto hide-scrollbar flex-nowrap">
                    <button onclick="handleTracking('${order.waybill || order.awb || ''}', '${order._id}')" class="bg-[#E2E2E2] rounded-[3px] flex items-center justify-center px-[10px] py-[6px] flex-shrink-0">
                        <span class="text-[#4D4848] text-[12px] font-medium font-['Roboto'] leading-[14px] whitespace-nowrap">Track Order</span>
                    </button>
                    <button onclick="contactSupport()" class="bg-[#E2E2E2] rounded-[3px] flex items-center justify-center px-[10px] py-[6px] flex-shrink-0">
                        <span class="text-[#4D4848] text-[12px] font-medium font-['Roboto'] leading-[14px] whitespace-nowrap">Customer Support</span>
                    </button>
                    ${order.invoiceUrl ? `<button onclick="window.open('${order.invoiceUrl}')" class="bg-[#E2E2E2] rounded-[3px] flex items-center justify-center px-[10px] py-[6px] flex-shrink-0">
                        <span class="text-[#4D4848] text-[12px] font-medium font-['Roboto'] leading-[14px] whitespace-nowrap">View Invoice</span>
                    </button>` : ''}
                    <button onclick="orderAgain('${product._id}')" class="bg-[#42AD42] rounded-[3px] flex items-center justify-center px-[10px] py-[6px] flex-shrink-0">
                        <span class="text-white text-[12px] font-medium font-['Roboto'] leading-[14px] whitespace-nowrap">Order Again</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function setupTabs(undelivered, delivered) {
    const tabs = document.querySelectorAll('#desktop-order-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // UI Update
            tabs.forEach(t => {
                t.classList.remove('active');
                t.querySelector('span').className = "text-[#525252] text-[20px] font-semibold font-['Poppins'] leading-[30px]";
                const div = t.querySelector('div');
                div.className = "w-full h-[1px] mt-[5px]";
                div.style.borderBottom = "1px solid rgba(0,0,0,0.28)";
                div.style.backgroundColor = "transparent";
            });

            tab.classList.add('active');
            tab.querySelector('span').className = "text-[#BE2229] text-[20px] font-semibold font-['Poppins'] leading-[30px]";
            const activeDiv = tab.querySelector('div');
            activeDiv.className = "w-full h-[2px] bg-[#BE2229] mt-[4px]";
            activeDiv.style.borderBottom = "none";

            // Data Update
            renderDesktopOrders(target === 'undelivered' ? undelivered : delivered);
        });
    });
}

function renderEmptyState() {
    const html = `
        <div class="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <img src="assets/images/header.png" class="h-12 opacity-20 mb-6 grayscale" alt="">
            <h2 class="text-2xl font-semibold text-gray-700 mb-2">No Orders Found</h2>
            <p class="text-gray-500 mb-8">Looks like you haven't placed any orders yet.</p>
            <a href="allproducts.html" class="bg-[#BE2229] text-white px-8 py-3 rounded-lg font-medium hover:bg-red-700 transition shadow-lg">Start Shopping</a>
        </div>
    `;
    const container = document.getElementById('orders-container');
    const mobileContainer = document.getElementById('mobile-orders-container');
    if (container) container.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
}

// 10. RELATED PRODUCTS SECTION
async function loadRelatedProducts() {
    const slider = document.getElementById('related-products');
    if (!slider) return;

    try {
        const data = await apiCall('/user/products/latest?limit=6', 'GET');
        const products = data.products || [];

        if (products.length === 0) {
            slider.innerHTML = '<div class="text-center w-full py-10 text-gray-400">No related products found</div>';
            return;
        }

        slider.innerHTML = products.map(p => buildProductCard(p, 'min-w-[171px] max-w-[171px]')).join('');

        initSliderControls(products.length);
    } catch (err) {
        console.warn('Failed to load related products:', err);
    }
}

function initSliderControls(totalCards) {
    const slider = document.getElementById('orders-product-slider');
    const prevBtn = document.getElementById('orders-slider-prev');
    const nextBtn = document.getElementById('orders-slider-next');
    const pageInfo = document.getElementById('orders-slider-info');

    if (!slider || !prevBtn || !nextBtn) return;

    const scrollStep = 194;
    const visibleCards = 6;

    function updatePageInfo() {
        const firstVisible = Math.round(slider.scrollLeft / scrollStep) + 1;
        const lastVisible = Math.min(firstVisible + visibleCards - 1, totalCards);
        if (pageInfo) pageInfo.textContent = firstVisible + '–' + lastVisible + ' of ' + totalCards;
    }

    nextBtn.onclick = () => { slider.scrollBy({ left: scrollStep, behavior: 'smooth' }); setTimeout(updatePageInfo, 350); };
    prevBtn.onclick = () => { slider.scrollBy({ left: -scrollStep, behavior: 'smooth' }); setTimeout(updatePageInfo, 350); };
    slider.onscroll = () => { clearTimeout(slider._t); slider._t = setTimeout(updatePageInfo, 100); };

    updatePageInfo();
}

function handleTracking(awb, orderId) {
    if (awb) {
        window.location.href = `track-order.html?awb=${awb}`;
    } else {
        Swal.fire({
            title: 'Shipment Pending',
            text: 'Your order is being processed. Tracking will be available once it is handed over to the courier.',
            icon: 'info',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#BE2229'
        });
    }
}

async function orderAgain(productId) {
    try {
        const product = await apiCall(`/products/${productId}`, 'GET');
        if (product) {
            handleAddToCart(
                product._id,
                product.name,
                productImg(product),
                product.price,
                product.discountedPrice,
                product.gstPercent || 18
            );
        }
    } catch (err) {
        showToast('Could not add product to cart', 'error');
    }
}

function contactSupport() {
    window.location.href = "mailto:support@springwala.in?subject=Order Support Request";
}

function shareOrder(id) {
    if (navigator.share) {
        navigator.share({
            title: 'My Order - Springwala',
            text: 'Check out my order on Springwala!',
            url: window.location.origin + '/order-success.html?id=' + id
        });
    } else {
        showToast('Link copied to clipboard!', 'success');
    }
}

function formatCurrency(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
    if (!d) return 'TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
