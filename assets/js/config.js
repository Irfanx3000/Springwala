/**
 * config.js - Centralized configuration for Springwala project.
 * Removes hardcoded localhost URLs to support seamless dev/prod transitions.
 */

const CONFIG = {
    // API Configuration
    API_BASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
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

// Global warn if using 127.0.0.1 which can cause CORS/Cookie issues
if (window.location.hostname === "127.0.0.1") {
    console.warn("⚠️ [Springwala] Using 127.0.0.1 might cause session issues. Please use http://localhost instead.");
}
