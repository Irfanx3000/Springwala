/**
 * admin-sidebar.js
 * Centralized logic for admin sidebar navigation, dropdowns, and mobile interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initDropdowns();
});

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    if (!sidebar || !overlay) return;

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
        // Prevent body scroll when menu is open on mobile
        if (!sidebar.classList.contains('-translate-x-full')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    openBtn?.addEventListener('click', toggleSidebar);
    closeBtn?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    // Close sidebar on window resize if switching to desktop (matching xl: 1280px)
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1280 && !sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
}

function initDropdowns() {
    // Dropdown configurations
    const dropdowns = [
        { btnId: 'products-menu-btn', subId: 'products-submenu', chevId: 'products-menu-chevron' },
        { btnId: 'banners-menu-btn', subId: 'banners-submenu', chevId: 'banners-menu-chevron' }
    ];

    dropdowns.forEach(config => {
        const btn = document.getElementById(config.btnId);
        const sub = document.getElementById(config.subId);
        const chev = document.getElementById(config.chevId);

        if (btn && sub) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isHidden = sub.classList.contains('hidden');
                
                // Close other dropdowns (Optional - commented out to allow multiple open)
                /*
                dropdowns.forEach(other => {
                    if (other.btnId !== config.btnId) {
                        const otherSub = document.getElementById(other.subId);
                        const otherChev = document.getElementById(other.chevId);
                        otherSub?.classList.add('hidden');
                        otherSub?.classList.remove('flex');
                        otherChev?.classList.remove('rotate-180');
                    }
                });
                */

                sub.classList.toggle('hidden', !isHidden);
                sub.classList.toggle('flex', isHidden);
                if (chev) {
                    chev.classList.toggle('rotate-180', isHidden);
                }
            });

            // Ensure chevron doesn't block clicks (though pointer-events-none in HTML is better)
            if (chev) {
                chev.style.pointerEvents = 'none';
            }
        }
    });
}
