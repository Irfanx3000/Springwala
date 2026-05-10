/**
 * Springwala Admin — auth.js
 * Centralized, production-grade authentication logic.
 * Solves race conditions, redirect loops, and persistence issues.
 */

const Auth = window.Auth = {
    // Storage keys (SSOT)
    TOKEN_KEY: 'sw_admin_token',
    USER_KEY: 'sw_admin',
    
    state: {
        isInitialized: false,
        isValidating: false,
        admin: null,
        token: null
    },

    /**
     * Bootstraps the authentication state.
     * Must be called at the very top of protected pages.
     */
    init: async function() {
        if (this.state.isInitialized) return this.isLoggedIn();

        this.state.token = localStorage.getItem(this.TOKEN_KEY);
        try {
            const userData = localStorage.getItem(this.USER_KEY);
            this.state.admin = userData ? JSON.parse(userData) : null;
        } catch (e) {
            console.error("[AUTH] Failed to parse cached admin data", e);
            this.state.admin = null;
        }

        this.state.isInitialized = true;
        console.log("[AUTH] State Hydrated:", { loggedIn: !!this.state.token });
        
        // Show body if hidden by bootstrap
        document.documentElement.classList.add('auth-initialized');
        const loader = document.getElementById('sw-auth-loader');
        if (loader) loader.style.display = 'none';

        return this.isLoggedIn();
    },

    getToken: function() {
        return this.state.token || localStorage.getItem(this.TOKEN_KEY);
    },

    getAdmin: function() {
        return this.state.admin;
    },

    setSession: function(token, admin) {
        this.state.token = token;
        this.state.admin = admin;
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(admin));
        this.state.isInitialized = true;
    },

    clearSession: function() {
        this.state.token = null;
        this.state.admin = null;
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    isLoggedIn: function() {
        return !!this.getToken();
    },

    logout: function(message) {
        if (message) console.warn("[AUTH] Logout triggered:", message);
        this.clearSession();
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/admin/login.html';
        }
    },

    /**
     * Backward compatibility wrapper.
     */
    requireAuth: function() {
        return this.requireAdminAuth();
    },

    /**
     * Strict Auth Guard with hydration wait.
     * Prevents race conditions on dashboard load.
     */
    requireAdminAuth: function() {
        const token = localStorage.getItem(this.TOKEN_KEY);
        if (!token) {
            console.warn("[AUTH] No token found during sync check. Redirecting...");
            this.logout();
            return false;
        }
        return true;
    },

    /**
     * Async validation with retry logic.
     * Prevents logouts due to temporary network blips.
     */
    validate: async function(retries = 1) {
        const token = this.getToken();
        if (!token) return false;

        this.state.isValidating = true;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/admin/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) {
                this.logout("Session truly expired (401)");
                return false;
            }

            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            
            const data = await res.json();
            if (data.success) {
                this.setSession(token, data.admin); // Refresh cache
                return true;
            }
            return false;
        } catch (err) {
            console.error(`[AUTH] Validation attempt failed (${retries} left):`, err.message);
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000));
                return this.validate(retries - 1);
            }
            return true; // Don't logout on network error
        } finally {
            this.state.isValidating = false;
        }
    }
};

// ─── Auth Bootstrap Injector ──────────────────────────────────────────────────
(function() {
    const path = window.location.pathname;
    const isAdminPage = path.includes('/admin/');
    const isLoginPage = path.includes('login.html');

    if (isAdminPage && !isLoginPage) {
        // Prevent FOPC
        const style = document.createElement('style');
        style.textContent = `
            html:not(.auth-initialized) body { display: none !important; }
            #sw-auth-loader { 
                position: fixed; inset: 0; background: #fff; z-index: 999999;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: sans-serif;
            }
            .sw-spinner { 
                width: 40px; height: 40px; border: 4px solid #f3f3f3; 
                border-top: 4px solid #BE2229; border-radius: 50%; 
                animation: sw-spin 1s linear infinite; 
            }
            @keyframes sw-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);

        const loader = document.createElement('div');
        loader.id = 'sw-auth-loader';
        loader.innerHTML = '<div class="sw-spinner"></div><p style="margin-top:15px;color:#666;font-size:14px;">Verifying Session...</p>';
        document.body.appendChild(loader);

        // Run Init
        Auth.init().then(loggedIn => {
            if (!loggedIn) {
                Auth.logout("Bootstrap: No session found");
            } else {
                Auth.validate(); // Background verify
            }
        });
    }
})();
