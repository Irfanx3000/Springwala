/**
 * config.js - Centralized configuration for Springwala project.
 * Removes hardcoded localhost URLs to support seamless dev/prod transitions.
 */

const CONFIG = {
    // API Configuration
    // The API_BASE_URL automatically switches between local development and production origins.
    API_BASE_URL: (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:5000/api"
        : `${window.location.origin}/api`,

    // Image/Upload Base URL
    IMAGE_BASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000"
        : window.location.origin,

    // Frontend Configuration
    FRONTEND_BASE_URL: window.location.origin,

    // Environment Detection
    isLocal: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
};

const ROUTES = {
    knowledge: "coming-soon.html"
};

window.ROUTES = ROUTES;

function applySharedRoutes() {
    document.querySelectorAll('a').forEach((link) => {
        const label = link.textContent.trim();
        if (label === 'Knowledge Centre' || label === 'Knowledge Section') {
            link.href = ROUTES.knowledge;
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySharedRoutes);
} else {
    applySharedRoutes();
}

// Global warn if using 127.0.0.1 which can cause CORS/Cookie issues
if (window.location.hostname === "127.0.0.1") {
    console.warn("⚠️ [Springwala] Using 127.0.0.1 might cause session issues. Please use http://localhost instead.");
}

// ── Auto-inject Springwala Modal System (sw-modal.js) ─────────────────────────
// Loaded here so it is available on ALL pages (admin + storefront) via config.js,
// which is the single universal bootstrap script across the entire project.
(function () {
    if (window.__swModalLoaded) return;
    window.__swModalLoaded = true;

    // Detect path depth to build correct relative path to assets/
    const scripts = document.querySelectorAll('script[src*="config.js"]');
    let basePath = 'assets/js/sw-modal.js';
    if (scripts.length > 0) {
        const src = scripts[scripts.length - 1].getAttribute('src');
        if (src && src.includes('../../')) {
            basePath = '../../assets/js/sw-modal.js';
        } else if (src && src.includes('../')) {
            basePath = '../assets/js/sw-modal.js';
        }
    }

    ['sw-modal.js', 'network-error-handler.js'].forEach((file) => {
        const s = document.createElement('script');
        s.src = basePath.replace('sw-modal.js', file);
        s.async = false;
        document.head.appendChild(s);
    });
})();
