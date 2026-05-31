/**
 * admin-sidebar.js
 * Centralized logic for admin sidebar navigation, dropdowns, and mobile interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    injectInquiriesMenuItem();
    initSidebar();
    initDropdowns();
    initActiveLink();
    initAdminHeader();
});

/**
 * Dynamically inject the "Inquiries" menu item globally in User-related sections
 */
function injectInquiriesMenuItem() {
    // 1. Skip if inquiries link already exists on the page (prevents duplicate on inquiries.html)
    if (document.querySelector('a[href*="inquiries.html"]')) return;

    // 2. Select Users link case-insensitively (covers both users.html and Users.html in inventory.html)
    const usersLink = document.querySelector('a[href*="users.html"], a[href*="Users.html"]');
    if (!usersLink) return;

    if (document.getElementById('sidebar-inquiries-link')) return;

    // Detect nesting depth via existing links
    const dashboardLink = document.querySelector('a[href*="dashboard.html"], a[href*="Dashboard.html"]');
    const isSubfolder = dashboardLink && dashboardLink.getAttribute('href').startsWith('../');

    const inquiriesHref = isSubfolder ? '../inquiries.html' : 'inquiries.html';
    const iconSrc = isSubfolder ? '../../assets/icons/admin/inquiries.svg' : '../assets/icons/admin/inquiries.svg';

    const inqLink = document.createElement('a');
    inqLink.id = 'sidebar-inquiries-link';
    inqLink.href = inquiriesHref;
    inqLink.className = "sidebar-item flex items-center px-[10px] py-[10px] gap-[15px] w-full group";
    inqLink.innerHTML = `
      <img
        src="${iconSrc}"
        alt="Inquiries"
        class="w-6 h-6 shrink-0"
      />
      <span
        class="font-['Poppins'] text-[19px] leading-[28px] text-black group-hover:text-[#BE2229]"
        >Inquiries</span
      >
    `;

    const divider = document.createElement('div');
    divider.className = "w-full h-[1px] bg-black/15";

    // Find the next sibling of users link to place inquiries item after the divider
    let nextEl = usersLink.nextElementSibling;
    if (nextEl) {
        if (nextEl.classList.contains('bg-black/15') || nextEl.tagName === 'DIV') {
            nextEl.after(inqLink);
            inqLink.after(divider);
        } else {
            usersLink.after(inqLink);
            inqLink.after(divider);
        }
    } else {
        usersLink.after(inqLink);
        inqLink.after(divider);
    }
}

/**
 * Mobile Sidebar Toggle Logic
 */
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    if (!sidebar || !overlay || !openBtn) return;

    // Prevent multiple initializations if script is loaded twice
    if (openBtn.dataset.sidebarInit) return;
    openBtn.dataset.sidebarInit = 'true';

    // Lightweight guard + instrumentation to avoid rapid toggles and main-thread spikes
    let _sidebarToggleInProgress = false;

    function toggleSidebar() {
        if (_sidebarToggleInProgress) return;
        _sidebarToggleInProgress = true;

        const start = (window.performance && performance.now) ? performance.now() : Date.now();

        requestAnimationFrame(() => {
            const isOpen = !sidebar.classList.contains('-translate-x-full');

            if (isOpen) {
                // Closing
                sidebar.classList.add('-translate-x-full');
                overlay.classList.add('hidden');
                if (document.body.style.overflow) document.body.style.overflow = '';
            } else {
                // Opening
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.remove('hidden');
                if (document.body.style.overflow !== 'hidden') document.body.style.overflow = 'hidden';
            }

            const delta = ((window.performance && performance.now) ? performance.now() : Date.now()) - start;
            if (delta > 50) console.warn(`[Sidebar] toggle took ${delta.toFixed(1)}ms`);

            // Small cooldown to prevent click floods
            setTimeout(() => { _sidebarToggleInProgress = false; }, 200);
        });
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
    });

    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
    });

    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
    });

    // Handle window resize to reset mobile states on desktop view
    window.addEventListener('resize', () => {
        const isDesktop = window.innerWidth >= 1280 ||
            (window.innerWidth >= 768 && !sidebar.classList.contains('xl:sticky'));

        if (isDesktop) {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
            // We don't force -translate-x-full here because on desktop it might be sticky/visible
        }
    });
}

/**
 * Sidebar Dropdown Expand/Collapse Logic
 */
function initDropdowns() {
    const dropdowns = [
        { btnId: 'products-menu-btn', subId: 'products-submenu', chevId: 'products-menu-chevron', keywords: ['products/'] },
        { btnId: 'banners-menu-btn', subId: 'banners-submenu', chevId: 'banners-menu-chevron', keywords: ['banners/'] }
    ];

    const currentPath = window.location.pathname;

    dropdowns.forEach(config => {
        const btn = document.getElementById(config.btnId);
        const sub = document.getElementById(config.subId);
        const chev = document.getElementById(config.chevId);

        if (btn && sub) {
            // Check if this menu should be open by default based on URL
            const shouldBeOpen = config.keywords.some(k => currentPath.includes(k));

            if (shouldBeOpen) {
                sub.classList.remove('hidden');
                sub.classList.add('flex');
                chev?.classList.add('rotate-180');
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isHidden = sub.classList.contains('hidden');

                // Toggle
                if (isHidden) {
                    sub.classList.remove('hidden');
                    sub.classList.add('flex');
                    chev?.classList.add('rotate-180');
                } else {
                    sub.classList.add('hidden');
                    sub.classList.remove('flex');
                    chev?.classList.remove('rotate-180');
                }
            });

            // Ensure chevron doesn't block clicks
            if (chev) chev.style.pointerEvents = 'none';
        }
    });
}

/**
 * Highlight the active link in the sidebar
 */
function initActiveLink() {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || 'dashboard.html';

    // 1. Regular Sidebar Items
    const mainItems = document.querySelectorAll('.sidebar-item:not(button)');
    mainItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && href.includes(currentFile)) {
            item.classList.add('active');
        }
    });

    // 2. Submenu Items
    const subLinks = document.querySelectorAll('#products-submenu a, #banners-submenu a');
    subLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes(currentFile)) {
            // Highlight sub-link
            link.classList.add('text-[#BE2229]', 'font-medium');
            link.classList.remove('text-slate-500', 'text-black', 'text-gray-500');

            // Also ensure parent button is styled correctly if not already active
            const parentBtn = link.closest('.group')?.querySelector('button.sidebar-item');
            if (parentBtn) {
                parentBtn.classList.add('active');
                const span = parentBtn.querySelector('span');
                if (span) span.classList.add('text-[#BE2229]', 'font-medium');
                const img = parentBtn.querySelector('img');
                if (img) img.style.filter = 'invert(21%) sepia(85%) saturate(3015%) hue-rotate(342deg) brightness(88%) contrast(96%)';
            }
        }
    });
}

/**
 * Inject admin name/role in header
 */
function initAdminHeader() {
    document.querySelectorAll('.admin-name').forEach(el => {
        el.textContent = 'Springwala';
    });
    
    // We can still keep the role dynamic if needed, or hide it if it's not part of the branding
    const admin = Auth.getAdmin();
    if (admin) {
        document.querySelectorAll('.admin-role').forEach(el => {
            el.textContent = admin.role || '';
        });
    }
}
