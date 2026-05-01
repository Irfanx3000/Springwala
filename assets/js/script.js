document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('close-menu').addEventListener('click', closeMenu);
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const body = document.body;

  /**
   * Toggles the Mobile Sidebar
   */
  function toggleMenu() {
    if (mobileMenu.classList.contains('hidden-menu')) {
      openMenu();
    } else {
      closeMenu();
    }
  }

  function openMenu() {
    mobileMenu.classList.remove('hidden-menu');
    mobileMenu.classList.add('show-menu');
    body.classList.add('overflow-hidden'); // Prevent background scrolling
  }

  function closeMenu() {
    mobileMenu.classList.remove('show-menu');
    mobileMenu.classList.add('hidden-menu');
    body.classList.remove('overflow-hidden');
  }

  // Event Listener for the Hamburger Click
  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }

  // Close menu when clicking outside of it
  window.addEventListener('click', (e) => {
    if (!mobileMenu.contains(e.target) && !mobileMenu.classList.contains('hidden-menu')) {
      closeMenu();
    }
  });
  // Mobile Sticky Header Scroll Logic
  let lastScrollTop = 0;
  const mobileSubHeader = document.getElementById('mobile-sub-header');
  let scrollDelta = 0;
  let isHeaderAnimating = false;

  window.addEventListener('scroll', () => {
    if (!mobileSubHeader || isHeaderAnimating) {
      lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      return;
    }

    let st = window.pageYOffset || document.documentElement.scrollTop;
    if (st < 0) return; // Prevent Safari bounce

    let diff = st - lastScrollTop;

    // Reset delta if direction changes
    if ((diff > 0 && scrollDelta < 0) || (diff < 0 && scrollDelta > 0)) {
      scrollDelta = 0;
    }

    scrollDelta += diff;

    // Add threshold of 50px from top and 15px scroll delta
    if (scrollDelta > 15 && st > 50 && !mobileSubHeader.classList.contains('hide-sub')) {
      // Scroll Down - Hide
      mobileSubHeader.classList.add('hide-sub');
      isHeaderAnimating = true;
      setTimeout(() => { isHeaderAnimating = false; scrollDelta = 0; }, 350);
    } else if (scrollDelta < -15 && mobileSubHeader.classList.contains('hide-sub')) {
      // Scroll Up - Show
      mobileSubHeader.classList.remove('hide-sub');
      isHeaderAnimating = true;
      setTimeout(() => { isHeaderAnimating = false; scrollDelta = 0; }, 350);
    }

    lastScrollTop = st;
  }, { passive: true });
});

// Geolocation Logic removed - Centralized in app.js
// Mobile Filter Drawer Logic
document.addEventListener('DOMContentLoaded', function () {
  const filterBtns = document.querySelectorAll('.filter-btn-mobile, button:has(svg path[d="M4 6H20M6 12H18M8 18H16"])');
  const filterDrawer = document.getElementById('filter-drawer');
  const filterOverlay = document.getElementById('filter-overlay');
  const closeFilterBtn = document.getElementById('close-filter');
  const applyFilterBtn = document.getElementById('apply-filter');

  function openFilter() {
    if (filterDrawer && filterOverlay) {
      filterOverlay.classList.remove('hidden');
      // Small delay to allow display to apply before opacity transition
      setTimeout(() => {
        filterOverlay.classList.remove('opacity-0');
        filterDrawer.classList.remove('translate-x-full');
      }, 10);
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFilter() {
    if (filterDrawer && filterOverlay) {
      filterOverlay.classList.add('opacity-0');
      filterDrawer.classList.add('translate-x-full');
      setTimeout(() => {
        filterOverlay.classList.add('hidden');
      }, 300);
      document.body.style.overflow = '';
    }
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', openFilter);
  });

  if (closeFilterBtn) closeFilterBtn.addEventListener('click', closeFilter);
  if (filterOverlay) filterOverlay.addEventListener('click', closeFilter);
  if (applyFilterBtn) applyFilterBtn.addEventListener('click', closeFilter);
});
