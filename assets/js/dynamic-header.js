/**
 * dynamic-header.js - Dynamic Storefront Header System
 * Loads, caches, and renders categories dropdown, mega menu, and navigation.
 */

(function () {
    // 1. Render immediate static shell of header to prevent layout shift
    const headerPlaceholder = document.getElementById('sw-header');
    if (!headerPlaceholder) return;

    // Load and format saved location for initial render hydration (prevents layout flashing)
    let defaultLocationText = 'Thane, Maharashtra';
    try {
        const stored = localStorage.getItem('userLocation');
        if (stored) {
            const locObj = JSON.parse(stored);
            let city = (locObj.city || '').trim();
            let state = (locObj.state || '').trim();
            if (!city) {
                city = (locObj.district || locObj.locality || '').trim();
            }
            // Clean string literals "undefined" or "null"
            if (city.toLowerCase() === 'undefined' || city.toLowerCase() === 'null') city = '';
            if (state.toLowerCase() === 'undefined' || state.toLowerCase() === 'null') state = '';

            if (city && state) {
                defaultLocationText = `${city}, ${state}`;
            } else if (city) {
                defaultLocationText = city;
            } else if (state) {
                defaultLocationText = state;
            } else if (locObj.pincode) {
                defaultLocationText = locObj.pincode;
            } else if (locObj.formattedAddress) {
                defaultLocationText = locObj.formattedAddress;
            }
        }
    } catch (e) {
        console.warn('Failed to parse cached location in header render:', e);
    }

    const page = window.location.pathname.split('/').pop() || 'index.html';
    const links = [
        { name: 'Home', href: 'index.html', active: page === 'index.html' || page === '' },
        { name: 'All Products', href: 'allproducts.html', active: page === 'allproducts.html' },
        { name: 'Orders', href: 'orders.html', active: page === 'orders.html' },
        { name: 'Knowledge Centre', href: '#', active: false },
        { name: 'Contact Us', href: 'contact-us.html', active: page === 'contact-us.html' }
    ];

    const navHtml = links.map(link => {
        if (link.active) {
            return `<li class="text-[#BE2229] font-medium border-b-2 border-[#BE2229] h-[56px] flex items-center cursor-pointer"><a href="${link.href}">${link.name}</a></li>`;
        } else {
            return `<li class="cursor-pointer hover:text-[#BE2229] transition h-[56px] flex items-center"><a href="${link.href}">${link.name}</a></li>`;
        }
    }).join('');

    headerPlaceholder.innerHTML = `
        <!-- Top Red Banner -->
        <div class="bg-[#BE2229] h-[24px] flex items-center justify-center">
            <span class="text-white text-[13px]">Get Flat 100% Discount on Selected Products</span>
        </div>

        <!-- Desktop Header Area -->
        <header class="bg-white sticky top-0 z-50">
            <!-- Top Nav Block (Search, Logo, Location) -->
            <div class="max-w-[1440px] mx-auto flex items-center justify-between px-[80px] h-[73px]">
                <img src="assets/images/header.png" alt="Springwala Logo" class="h-[40px] w-auto cursor-pointer" onclick="window.location.href='index.html'">

                <div class="flex items-start gap-2 ml-8 cursor-pointer">
                    <img src="assets/icons/desktop/location.svg" alt="Location" class="w-4 h-4 mt-1 text-[#747474]">
                    <div class="flex flex-col min-w-0">
                        <span class="text-[#747474] text-[10px]">Location</span>
                        <span class="text-[#242323] text-[12px] font-medium navbar-location-text truncate max-w-[120px] lg:max-w-[160px] inline-block" title="${defaultLocationText}">${defaultLocationText}</span>
                    </div>
                </div>

                <!-- Search Bar Block -->
                <div class="flex-1 max-w-[519px] mx-10 flex h-[40px] relative" id="search-bar-container">
                    <!-- DROPDOWN 2: All Categories (Near Search Bar) -->
                    <div class="relative group border border-[#BE2229] rounded-l-[6px] px-3 flex items-center gap-2 cursor-pointer bg-white h-full z-50" id="search-cat-trigger">
                        <span id="selected-category-text" class="text-[#BE2229] text-[13px] whitespace-nowrap" data-slug="">All Categories</span>
                        <svg class="w-3 h-3 text-[#BE2229]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"></path>
                        </svg>

                        <!-- All Categories Dropdown List -->
                        <div class="dropdown-menu absolute left-0 top-[100%] mt-[6px] w-[277px] bg-[#FFFFFF] shadow-[0px_4px_7.8px_rgba(0,0,0,0.25)] py-4 px-4 flex flex-col gap-[9px] cursor-default rounded-b-[4px] z-50">
                            <span class="font-['Roboto'] font-normal text-[16px] text-[#BE2229] pl-1 cursor-pointer search-cat-item" data-slug="" data-name="All Categories">All Categories</span>
                            <div class="w-full h-[0.5px] bg-[#000000] my-[2px]"></div>
                            
                            <!-- List Items -->
                            <div class="flex flex-col gap-[10px] pl-1" id="search-cat-list">
                                <div class="flex items-center justify-center py-2" id="search-cat-spinner">
                                    <div class="animate-spin w-4 h-4 border-2 border-[#BE2229] border-t-transparent rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 border border-[#D7D9D9] border-l-0 rounded-r-[6px] flex items-center px-3 bg-white">
                        <input type="text" id="desktop-search-input" class="flex-1 outline-none text-[13px] h-full" placeholder="Search Products..." autocomplete="off">
                        <img src="assets/icons/desktop/search.svg" alt="Search" class="w-5 h-5 text-[#797979] cursor-pointer" id="desktop-search-btn">
                    </div>

                    <!-- Autocomplete Suggestions Dropdown -->
                    <div id="search-suggestions-dropdown" class="hidden absolute left-0 right-0 top-[100%] mt-[6px] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.15)] rounded-[6px] z-50 overflow-y-auto no-scrollbar max-h-[450px] border border-gray-100">
                    </div>
                </div>

                <!-- Profile & Cart -->
                <div class="flex items-center gap-7">
                    <a href="login.html" class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition" id="header-profile-link">
                        <img src="assets/icons/desktop/profile.svg" alt="Account" class="w-6 h-6 text-[#525252] header-user-icon">
                        <span class="text-[#525252] text-[15px] user-first-name">Your Account</span>
                    </a>
                    <a href="cart.html" class="cursor-pointer hover:opacity-80 transition relative">
                        <img src="assets/icons/desktop/cart.svg" alt="Cart" class="w-6 h-6 text-[#525252]">
                        <span class="cart-badge absolute -top-1 -right-2 bg-[#BE2229] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">0</span>
                    </a>
                    <a href="wishlist.html" class="cursor-pointer hover:opacity-80 transition relative">
                        <img src="assets/icons/desktop/saved-items.svg" alt="Wishlist" class="w-6 h-6 text-[#525252]">
                    </a>
                </div>
            </div>
            
            <!-- Bottom Nav Block (Browse Categories & Links) -->
            <div class="border-t border-[#E8E8E8] relative z-40 bg-white shadow-sm">
                <div class="max-w-[1440px] mx-auto flex items-center h-[56px] px-[80px]">
                    
                    <!-- DROPDOWN 1: Browse All Categories -->
                    <div class="relative group h-full flex items-center" id="mega-menu-trigger">
                        <a href="categories.html" class="bg-[#BE2229] border border-[#BE2229] rounded-[5px] px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-red-800 transition">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            <span class="text-white text-[12px] font-medium uppercase">Browse All Categories</span>
                        </a>

                        <!-- Browse All Categories Mega Menu -->
                        <div class="dropdown-menu absolute left-0 top-[100%] w-[1195px] bg-[#F4F6F6] shadow-[0px_4px_4px_rgba(0,0,0,0.25),-1px_10px_7.3px_rgba(0,0,0,0.09)] py-[35px] px-[40px] flex flex-wrap gap-x-[30px] gap-y-[20px] cursor-default justify-start" id="mega-menu-content">
                            <div class="flex items-center justify-center py-4 w-full" id="mega-menu-spinner">
                                <div class="animate-spin w-6 h-6 border-2 border-[#BE2229] border-t-transparent rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation Links -->
                    <ul class="flex items-center gap-8 ml-10 text-[15px] text-[#525252]" id="desktop-nav-links">
                        ${navHtml}
                    </ul>

                    <!-- Customer Support Banner -->
                    <div class="ml-auto h-[42px] cursor-pointer hover:opacity-90 transition">
                        <img src="assets/banners/customer-support.png" alt="Customer Support" class="h-full w-auto">
                    </div>
                </div>
            </div>
        </header>
    `;

    // 2. Fetch and hydrate the categories from API
    async function loadCategories() {
        const CACHE_KEY = 'sw_categories_cache';
        try {
            // Attempt to read from session storage cache first
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                renderDropdowns(data.categories);
                return;
            }

            const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/user/categories`);
            if (!res.ok) throw new Error('API request failed');
            
            const data = await res.json();
            if (data && data.success && Array.isArray(data.categories)) {
                // Store in cache
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
                renderDropdowns(data.categories);
            } else {
                showErrorState();
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
            showErrorState();
        }
    }

    function renderDropdowns(categories) {
        const searchList = document.getElementById('search-cat-list');
        const megaMenu = document.getElementById('mega-menu-content');

        // Render Search Dropdown items
        if (searchList) {
            if (categories.length === 0) {
                searchList.innerHTML = `<span class="text-gray-500 text-[13px] pl-1">No categories</span>`;
            } else {
                searchList.innerHTML = categories.map(cat => `
                    <span class="font-['Roboto'] font-normal text-[16px] text-[#000000] hover:text-[#BE2229] transition cursor-pointer search-cat-item" data-slug="${cat.slug}" data-name="${cat.name}">${cat.name}</span>
                `).join('');
            }
        }

        // Render Mega Menu columns
        if (megaMenu) {
            if (categories.length === 0) {
                megaMenu.innerHTML = `<div class="w-full text-center text-gray-500 py-4">No categories found</div>`;
            } else {
                megaMenu.innerHTML = categories.map(cat => {
                    const sublinks = (cat.subcategories || []).map(sub => `
                        <a href="allproducts.html?subcategory=${sub.slug}" class="font-['Roboto'] font-normal text-[16px] text-[#000000] hover:text-[#BE2229] transition">${sub.name}</a>
                    `).join('');
                    
                    return `
                        <div class="flex flex-col gap-[9px] w-[190px]">
                            <h3 class="font-['Roboto'] font-medium text-[18px] text-[#000000] whitespace-nowrap hover:text-[#BE2229] transition">
                                <a href="allproducts.html?category=${cat.slug}">${cat.name}</a>
                            </h3>
                            <div class="w-full h-[0.5px] bg-[#000000] my-[2px]"></div>
                            ${sublinks || '<span class="text-gray-400 text-xs italic">No subcategories</span>'}
                        </div>
                    `;
                }).join('');
            }
        }
    }

    // 3. Autocomplete Custom Styles Injection
    if (!document.getElementById('sw-storefront-search-style')) {
        const s = document.createElement('style');
        s.id = 'sw-storefront-search-style';
        s.textContent = `
            .suggest-section-title { font-family: Poppins, sans-serif; font-size: 11px; font-weight: 700; color: #BE2229; padding: 10px 16px 6px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #f3f4f6; background-color: #fafafa; }
            .suggest-item { display: flex; align-items: center; gap: 12px; padding: 8px 16px; transition: background 0.15s; cursor: pointer; font-family: Roboto, sans-serif; }
            .suggest-item:hover, .suggest-item.active { background: #f3f4f6; }
            .suggest-item img { width: 35px; height: 35px; border-radius: 4px; object-fit: contain; background: #fff; border: 1px solid #e5e7eb; flex-shrink: 0; }
            .suggest-item .info { display: flex; flex-direction: column; overflow: hidden; flex-grow: 1; text-align: left; }
            .suggest-item .name { font-weight: 500; font-size: 13px; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .suggest-item .meta { font-size: 11px; color: #6b7280; }
            .suggest-item .price { margin-left: auto; font-weight: 600; font-size: 13px; color: #BE2229; flex-shrink: 0; }
            .suggest-highlight { font-weight: 700; color: #BE2229; }
        `;
        document.head.appendChild(s);
    }

    // 4. Bind interactions and search submission handlers
    function saveRecentSearch(query) {
        if (!query) return;
        try {
            let recent = JSON.parse(localStorage.getItem('sw_recent_searches') || '[]');
            recent = recent.filter(s => s.toLowerCase() !== query.toLowerCase());
            recent.unshift(query);
            recent = recent.slice(0, 5);
            localStorage.setItem('sw_recent_searches', JSON.stringify(recent));
        } catch (e) {
            console.error('Error saving recent search:', e);
        }
    }

    function handleSearchSubmit() {
        const searchInput = document.getElementById('desktop-search-input');
        const selectedCat = document.getElementById('selected-category-text');
        if (!searchInput) return;

        const query = searchInput.value.trim();
        const catSlug = selectedCat ? selectedCat.getAttribute('data-slug') : '';

        if (query) {
            saveRecentSearch(query);
        }

        const params = [];
        if (query) params.push(`search=${encodeURIComponent(query)}`);
        if (catSlug) params.push(`category=${encodeURIComponent(catSlug)}`);

        window.location.href = 'allproducts.html' + (params.length ? '?' + params.join('&') : '');
    }

    // Event delegation inside the header
    document.addEventListener('click', function (e) {
        // Dropdown selection item clicked
        const catItem = e.target.closest('.search-cat-item');
        if (catItem && headerPlaceholder.contains(catItem)) {
            const name = catItem.getAttribute('data-name');
            const slug = catItem.getAttribute('data-slug');
            const label = document.getElementById('selected-category-text');
            if (label) {
                label.textContent = name;
                label.setAttribute('data-slug', slug);
            }
        }

        // Search button clicked
        if (e.target.id === 'desktop-search-btn') {
            e.preventDefault();
            handleSearchSubmit();
        }
    });

    // 5. Predictive Live Search Suggestions Logic
    const dropdown = document.getElementById('search-suggestions-dropdown');
    let searchDebounceTimer;
    let abortController = null;
    const cache = {}; // suggestions cache
    let activeIndex = -1;
    let itemsList = [];

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function highlightText(text, query) {
        if (!query) return escapeHtml(text);
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapeHtml(text).replace(regex, '<span class="suggest-highlight">$1</span>');
    }

    function formatInRupees(price) {
        return '₹' + Number(price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function fetchSearchSuggestions(query) {
        if (!query) {
            renderRecentAndTrending();
            return;
        }

        const cachedData = cache[query.toLowerCase()];
        if (cachedData) {
            renderSearchSuggestions(cachedData, query);
            return;
        }

        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
            dropdown.innerHTML = `
                <div class="p-4 flex flex-col gap-3">
                    <div class="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                    <div class="h-8 bg-gray-100 rounded animate-pulse w-full"></div>
                    <div class="h-8 bg-gray-100 rounded animate-pulse w-full"></div>
                    <div class="h-8 bg-gray-100 rounded animate-pulse w-full"></div>
                </div>
            `;
            dropdown.classList.remove('hidden');

            const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(query)}`, { signal: abortController.signal });
            if (!res.ok) throw new Error('API failed');

            const data = await res.json();
            if (data && data.success) {
                cache[query.toLowerCase()] = data;
                renderSearchSuggestions(data, query);
            } else {
                renderErrorUI();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                renderErrorUI();
            }
        }
    }

    function renderErrorUI() {
        dropdown.innerHTML = `<div class="py-6 text-center text-red-500 text-[13px]">Error loading suggestions. Please try again.</div>`;
    }

    function renderSearchSuggestions(data, query) {
        const { products, categories, suggestions } = data;
        itemsList = [];
        activeIndex = -1;
        let html = '';

        // A. Autocomplete string suggestions
        if (suggestions && suggestions.length) {
            html += `<div class="suggest-section-title">Suggestions</div>`;
            suggestions.forEach(s => {
                const itemId = `suggest-item-${itemsList.length}`;
                itemsList.push({ type: 'suggestion', value: s });
                html += `
                    <div class="suggest-item" id="${itemId}" data-type="suggestion" data-val="${escapeHtml(s)}">
                        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <div class="info">
                            <span class="name">${highlightText(s, query)}</span>
                        </div>
                    </div>
                `;
            });
        }

        // B. Categories mapping
        if (categories && categories.length) {
            html += `<div class="suggest-section-title">Categories</div>`;
            categories.forEach(c => {
                const itemId = `suggest-item-${itemsList.length}`;
                itemsList.push({ type: 'category', value: c.slug });
                html += `
                    <div class="suggest-item" id="${itemId}" data-type="category" data-val="${escapeHtml(c.slug)}">
                        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                        <div class="info">
                            <span class="name">${highlightText(c.name, query)}</span>
                            <span class="meta">${c.productCount || 0} products available</span>
                        </div>
                    </div>
                `;
            });
        }

        // C. Products matches
        if (products && products.length) {
            html += `<div class="suggest-section-title">Products</div>`;
            products.forEach(p => {
                const itemId = `suggest-item-${itemsList.length}`;
                itemsList.push({ type: 'product', value: p._id });

                const img = (p.images && p.images[0]) ? p.images[0] : 'assets/images/deafult.png';
                const imageBaseUrl = (typeof CONFIG !== 'undefined' && CONFIG.IMAGE_BASE_URL) ? CONFIG.IMAGE_BASE_URL : 'http://localhost:5000/';
                const fullImgUrl = img.startsWith('http') ? img : (imageBaseUrl + img);
                const price = p.finalPrice || p.price;

                html += `
                    <div class="suggest-item" id="${itemId}" data-type="product" data-val="${escapeHtml(p._id)}">
                        <img src="${fullImgUrl}" alt="${escapeHtml(p.name)}">
                        <div class="info">
                            <span class="name">${highlightText(p.name, query)}</span>
                            <span class="meta">${escapeHtml(p.category?.name || 'Category')}</span>
                        </div>
                        <span class="price">${formatInRupees(price)}</span>
                    </div>
                `;
            });
        }

        if (!html) {
            html = `<div class="py-8 text-center text-gray-500 text-[13px]">No matches found for "${escapeHtml(query)}"</div>`;
        }

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }

    function renderRecentAndTrending() {
        let recent = [];
        try {
            recent = JSON.parse(localStorage.getItem('sw_recent_searches') || '[]');
        } catch {}
        const trending = ['die springs', 'fasteners', 'circlips', 'screws', 'industrial springs'];

        itemsList = [];
        activeIndex = -1;
        let html = '';

        if (recent.length > 0) {
            html += `<div class="suggest-section-title">Recent Searches</div>`;
            recent.forEach(r => {
                const itemId = `suggest-item-${itemsList.length}`;
                itemsList.push({ type: 'suggestion', value: r });
                html += `
                    <div class="suggest-item" id="${itemId}" data-type="suggestion" data-val="${escapeHtml(r)}">
                        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <div class="info">
                            <span class="name">${escapeHtml(r)}</span>
                        </div>
                    </div>
                `;
            });
        }

        html += `<div class="suggest-section-title">Trending Searches</div>`;
        trending.forEach(t => {
            const itemId = `suggest-item-${itemsList.length}`;
            itemsList.push({ type: 'suggestion', value: t });
            html += `
                <div class="suggest-item" id="${itemId}" data-type="suggestion" data-val="${escapeHtml(t)}">
                    <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                    <div class="info">
                        <span class="name">${escapeHtml(t)}</span>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
    }

    // Input handlers
    const inputHandler = (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => fetchSearchSuggestions(query), 300);
    };

    const searchInputEl = document.getElementById('desktop-search-input');
    if (searchInputEl) {
        searchInputEl.addEventListener('input', inputHandler);
        
        searchInputEl.addEventListener('focus', () => {
            const query = searchInputEl.value.trim();
            if (query) {
                fetchSearchSuggestions(query);
            } else {
                renderRecentAndTrending();
            }
        });

        searchInputEl.addEventListener('keydown', function (e) {
            if (dropdown.classList.contains('hidden')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    handleSearchSubmit();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (itemsList.length === 0) return;

                if (activeIndex >= 0) {
                    const prevEl = document.getElementById(`suggest-item-${activeIndex}`);
                    if (prevEl) prevEl.classList.remove('active');
                }

                activeIndex = (activeIndex + 1) % itemsList.length;

                const activeEl = document.getElementById(`suggest-item-${activeIndex}`);
                if (activeEl) {
                    activeEl.classList.add('active');
                    activeEl.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (itemsList.length === 0) return;

                if (activeIndex >= 0) {
                    const prevEl = document.getElementById(`suggest-item-${activeIndex}`);
                    if (prevEl) prevEl.classList.remove('active');
                }

                activeIndex = activeIndex - 1;
                if (activeIndex < 0) activeIndex = itemsList.length - 1;

                const activeEl = document.getElementById(`suggest-item-${activeIndex}`);
                if (activeEl) {
                    activeEl.classList.add('active');
                    activeEl.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (activeIndex >= 0 && activeIndex < itemsList.length) {
                    const selected = itemsList[activeIndex];
                    if (selected.type === 'suggestion') {
                        searchInputEl.value = selected.value;
                        dropdown.classList.add('hidden');
                        handleSearchSubmit();
                    } else if (selected.type === 'category') {
                        window.location.href = `allproducts.html?category=${encodeURIComponent(selected.value)}`;
                    } else if (selected.type === 'product') {
                        window.location.href = `product.html?id=${encodeURIComponent(selected.value)}`;
                    }
                } else {
                    handleSearchSubmit();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                dropdown.classList.add('hidden');
            }
        });

        // Hide suggestions on document click outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== searchInputEl) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // Handles item click selections in the dropdown using event delegation
    dropdown.addEventListener('click', function (e) {
        const item = e.target.closest('.suggest-item');
        if (item) {
            const type = item.getAttribute('data-type');
            const val = item.getAttribute('data-val');

            if (type === 'suggestion') {
                if (searchInputEl) searchInputEl.value = val;
                dropdown.classList.add('hidden');
                handleSearchSubmit();
            } else if (type === 'category') {
                window.location.href = `allproducts.html?category=${encodeURIComponent(val)}`;
            } else if (type === 'product') {
                window.location.href = `product.html?id=${encodeURIComponent(val)}`;
            }
        }
    });

    // Trigger categories loading
    loadCategories();
})();
