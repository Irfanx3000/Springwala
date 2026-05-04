/**
 * admin-sidebar.js
 * Centralized logic for admin sidebar navigation, dropdowns, and mobile interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initDropdowns();
    initActiveLink();
});

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

    function toggleSidebar() {
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        
        if (isOpen) {
            // Closing
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        } else {
            // Opening
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
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
        { btnId: 'products-menu-btn', subId: 'products-submenu', chevId: 'products-menu-chevron', keywords: ['products/', 'categories.html'] },
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
