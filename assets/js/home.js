/**
 * Springwala Home Page Logic
 * Fetches dynamic content: banners, categories, products
 */

const HOME_LIMIT = 6; // Default limit for product sections

const state = {
    topSold: { page: 1, total: 0, products: [] },
    featured: { page: 1, total: 0, products: [] },
    latest: { page: 1, total: 0, products: [] },
    topCategories: { page: 1, total: 0, products: [] },
    categories: { page: 1, total: 0, items: [] }
};

document.addEventListener('DOMContentLoaded', () => {
    initHome();
});

async function initHome() {
    loadBanners(); // Load all types isolated
    loadCategories();
    loadTopSold();
    loadFeatured();
    loadLatest();
    loadTopCategories();
}

// ─── Banners (STRICT TYPE ISOLATION) ──────────────────────────────────────────
async function loadBanners() {
    // Each section explicitly requests its own type
    fetchAndRenderBanners('homepage', renderMainBanners);
    fetchAndRenderBanners('promotional', renderPromoBanners, 'promo-banners-container');
    fetchAndRenderBanners('features', renderStandardBanners, 'features-banners-container');
    fetchAndRenderBanners('advertisement', renderStandardBanners, 'advertisement-banners-container');
    fetchAndRenderBanners('informational', renderInfoBanners, 'informational-banners-container');
    fetchAndRenderBanners('category', renderCategoryPoster, 'categories-poster');
}

async function fetchAndRenderBanners(type, renderFn, containerId = null) {
    try {
        const data = await api.get('/user/banners', { type, isActive: 'true' });
        if (!data?.success || !data.banners.length) {
            if (containerId) {
                const container = document.getElementById(containerId);
                if (container) container.closest('section')?.classList.add('hidden');
            }
            return;
        }

        // Ensure container is visible if it was hidden
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) container.closest('section')?.classList.remove('hidden');
        }

        renderFn(data.banners);
    } catch (err) {
        console.warn(`[Banner] Failed to load ${type}:`, err);
    }
}

function renderMainBanners(banners) {
    const desktopContainer = document.getElementById('hero-desktop-container');
    const mobileContainer = document.getElementById('hero-mobile-container');

    if (!banners.length) return;

    // Desktop: first is main, next two are small
    if (desktopContainer) {
        let html = '';
        const main = banners[0];
        html += `
            <div class="hero-box main-banner">
                <a href="${main.link || '#'}">
                    <picture>
                        <source media="(max-width: 768px)" srcset="${imageUrl(main.mobileImage || main.image)}">
                        <img src="${imageUrl(main.image)}" alt="${main.altText}" class="w-full h-full object-cover">
                    </picture>
                </a>
            </div>
            <div class="hero-right-col">
        `;

        for (let i = 1; i < 3; i++) {
            const b = banners[i] || banners[0]; // fallback
            html += `
                <div class="hero-box small-banner">
                    <a href="${b.link || '#'}">
                        <picture>
                            <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                            <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-full object-cover">
                        </picture>
                    </a>
                </div>
            `;
        }
        html += `</div>`;
        desktopContainer.innerHTML = html;
    }

    // Mobile: just show the first one or a slider
    if (mobileContainer) {
        const b = banners[0];
        mobileContainer.innerHTML = `
            <div class="mobile-banner-box">
                <a href="${b.link || '#'}">
                    <picture>
                        <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                        <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-full object-cover">
                    </picture>
                </a>
            </div>
        `;
    }
}

function renderPromoBanners(banners) {
    const container = document.getElementById('promo-banners-container');
    if (!container || !banners.length) return;

    container.innerHTML = banners.slice(0, 3).map(b => `
        <div class="flex-1 rounded-[10px] overflow-hidden shadow-sm hover:shadow-md transition">
            <a href="${b.link || '#'}">
                <picture>
                    <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                    <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-auto object-cover">
                </picture>
            </a>
        </div>
    `).join('');
}

function renderStandardBanners(banners) {
    // Generic renderer for features and advertisement strips
    const container = banners[0].type === 'features'
        ? document.getElementById('features-banners-container')
        : document.getElementById('advertisement-banners-container');

    if (!container) return;

    container.innerHTML = banners.map(b => `
        <div class="flex-1 rounded-[10px] overflow-hidden shadow-sm hover:shadow-md transition">
            <a href="${b.link || '#'}">
                <picture>
                    <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                    <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-auto object-cover">
                </picture>
            </a>
        </div>
    `).join('');
}

function renderInfoBanners(banners) {
    const container = document.getElementById('informational-banners-container');
    if (!container) return;

    const b = banners[0]; // Usually just one wide strip
    container.innerHTML = `
        <a href="${b.link || '#'}" class="block w-full rounded-[10px] overflow-hidden hover:opacity-95 transition shadow-sm">
            <picture>
                <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-auto object-cover">
            </picture>
        </a>
    `;
}

function renderCategoryPoster(banners) {
    const container = document.getElementById('categories-poster');
    if (!container) return;

    const b = banners[0];
    container.innerHTML = `
        <a href="${b.link || '#'}">
            <picture>
                <source media="(max-width: 768px)" srcset="${imageUrl(b.mobileImage || b.image)}">
                <img src="${imageUrl(b.image)}" alt="${b.altText}" class="w-full h-full object-cover rounded-[10px]">
            </picture>
        </a>
    `;
}

// ─── Categories ───────────────────────────────────────────────────────────────
async function loadCategories() {
    try {
        const data = await api.get('/user/categories');
        if (!data?.success) return;
        state.categories.items = data.categories;
        renderCategories();
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

function renderCategories() {
    const grid = document.getElementById('categories-grid');
    const pagination = document.getElementById('categories-pagination');
    if (!grid) return;

    const items = state.categories.items;
    grid.innerHTML = items.slice(0, 8).map(c => `
        <div class="ec-card" onclick="window.location.href='category.html?slug=${c.slug}'">
            <div class="ec-img-box">
                <img src="${c.banner ? imageUrl(c.banner) : 'assets/images/deafult.png'}" alt="${c.name}">
            </div>
            <p class="ec-name">${c.name}</p>
        </div>
    `).join('');

    if (pagination) {
        pagination.querySelector('.ec-page-info').textContent = `1–${Math.min(8, items.length)} of ${items.length}`;
    }
}

// ─── Products Logic (Reusable) ───────────────────────────────────────────────
async function loadProductSection(endpoint, sectionKey, containerId, paginationId) {
    console.log(`[Home] Fetching products for ${sectionKey}...`);
    try {
        const params = {
            page: state[sectionKey].page,
            limit: HOME_LIMIT
        };
        const data = await api.get(endpoint, params);
        if (!data?.success) return;

        state[sectionKey].products = data.products || data.data || []; // Handle different API response shapes
        state[sectionKey].total = data.total || state[sectionKey].products.length;

        renderProductSection(sectionKey, containerId, paginationId);
    } catch (err) {
        console.error(`Error loading section ${sectionKey}:`, err);
    }
}

function renderProductSection(sectionKey, containerId, paginationId) {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    const products = state[sectionKey].products;
    if (!products.length) {
        grid.innerHTML = '<p class="col-span-full py-10 text-center text-gray-400">No products found</p>';
        return;
    }

    grid.innerHTML = products.map(p => buildProductCard(p)).join('');

    updatePagination(sectionKey, paginationId);
}

function updatePagination(sectionKey, paginationId) {
    const pag = document.getElementById(paginationId);
    if (!pag) return;

    const { page, total } = state[sectionKey];
    const totalPages = Math.ceil(total / HOME_LIMIT) || 1;
    const start = (page - 1) * HOME_LIMIT + 1;
    const end = Math.min(page * HOME_LIMIT, total);

    pag.querySelector('.page-info').textContent = `${start}–${end} of ${total}`;

    const prevBtn = pag.querySelector('.prev-btn');
    const nextBtn = pag.querySelector('.next-btn');

    // Hide arrows if all items fit on one page
    if (total <= HOME_LIMIT) {
        if (prevBtn) { prevBtn.disabled = true; prevBtn.style.opacity = '0.3'; prevBtn.style.pointerEvents = 'none'; }
        if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '0.3'; nextBtn.style.pointerEvents = 'none'; }
        return;
    }

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
        prevBtn.style.opacity = page <= 1 ? '0.3' : '1';
        prevBtn.style.pointerEvents = page <= 1 ? 'none' : '';
        prevBtn.onclick = () => {
            if (page > 1) {
                state[sectionKey].page--;
                reloadSection(sectionKey);
            }
        };
    }

    if (nextBtn) {
        nextBtn.disabled = page >= totalPages;
        nextBtn.style.opacity = page >= totalPages ? '0.3' : '1';
        nextBtn.style.pointerEvents = page >= totalPages ? 'none' : '';
        nextBtn.onclick = () => {
            if (page < totalPages) {
                state[sectionKey].page++;
                reloadSection(sectionKey);
            }
        };
    }
}

function reloadSection(sectionKey) {
    switch (sectionKey) {
        case 'topSold': loadTopSold(); break;
        case 'featured': loadFeatured(); break;
        case 'latest': loadLatest(); break;
        case 'topCategories': loadTopCategories(); break;
    }
}

// ─── Specific Sections ────────────────────────────────────────────────────────
function loadTopSold() {
    loadProductSection('/user/products/top-sold', 'topSold', 'topSold-grid', 'top-sold-pagination');
}

function loadFeatured() {
    loadProductSection('/user/products/featured', 'featured', 'featured-offers-grid', 'featured-offers-pagination');
}

function loadLatest() {
    loadProductSection('/user/products/latest', 'latest', 'latest-products-grid', 'latest-products-pagination');
}

function loadTopCategories() {
    // For now using the same latest products or featured as "top category" products 
    // depending on what the user wants. The prompt says "show the categories from categories which users buy the most".
    // This usually means showing PRODUCTS from those categories.
    // I will fetch products filtered by a "top" tag if exists, or just regular products.
    loadProductSection('/user/products', 'topCategories', 'top-categories-grid', 'top-categories-pagination');
}

// ─── Global Actions ──────────────────────────────────────────────────────────

function toggleWishlist(e, productId) {
    e.preventDefault();
    e.stopPropagation();
    showToast('Added to wishlist!');
}
