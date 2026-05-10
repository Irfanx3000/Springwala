/**
 * Springwala Admin — auth.js
 * Optimized authentication logic: Optimistic access + Silent background validation.
 */

const Auth = window.Auth = {
    TOKEN_KEY: 'sw_admin_token',
    USER_KEY: 'sw_admin',
    
    state: {
        isInitialized: false,
        isValidating: false,
        admin: null,
        token: null
    },

    /**
     * Optimistic hydration. Instant access if token exists.
     */
    init: function() {
        if (this.state.isInitialized) return this.isLoggedIn();

        this.state.token = localStorage.getItem(this.TOKEN_KEY);
        try {
            const userData = localStorage.getItem(this.USER_KEY);
            this.state.admin = userData ? JSON.parse(userData) : null;
        } catch (e) {
            this.state.admin = null;
        }

        this.state.isInitialized = true;
        
        // Instant UI stabilization
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

    logout: function(reason = "Manual") {
        console.warn(`[AUTH] Logout: ${reason}`);
        this.clearSession();
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/admin/login.html';
        }
    },

    requireAuth: function() {
        return this.requireAdminAuth();
    },

    /**
     * OPTIMISTIC GUARD: Only check if token exists.
     * Never blocks dashboard rendering.
     */
    requireAdminAuth: function() {
        if (!this.getToken()) {
            this.logout("Session missing");
            return false;
        }
        return true;
    },

    /**
     * SILENT BACKGROUND VALIDATION
     * Runs after page load. Non-blocking.
     */
    validate: async function() {
        if (this.state.isValidating) return;
        const token = this.getToken();
        if (!token) return false;

        this.state.isValidating = true;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/admin/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) {
                this.logout("Session expired");
                return false;
            }

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    this.state.admin = data.admin;
                    localStorage.setItem(this.USER_KEY, JSON.stringify(data.admin));
                }
            }
            return true;
        } catch (err) {
            // Network failure: Preserve session
            return true; 
        } finally {
            this.state.isValidating = false;
        }
    }
};

// ─── Auth Bootstrap ──────────────────────────────────────────────────
(function() {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isAdminPage = path.includes('/admin/');

    if (isAdminPage && !isLoginPage) {
        // Prevent FOPC with instant hydration
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
        loader.innerHTML = '<div class="sw-spinner"></div><p style="margin-top:15px;color:#666;font-size:14px;">Initializing...</p>';
        
        // Ensure body exists before appending
        const checkBody = setInterval(() => {
            if (document.body) {
                document.body.appendChild(loader);
                clearInterval(checkBody);
                
                // Optimistic Init after loader is attached
                const loggedIn = Auth.init();
                if (!loggedIn) {
                    Auth.logout("Bootstrap: No session");
                } else {
                    // Silent background validation after load
                    window.addEventListener('load', () => {
                        setTimeout(() => Auth.validate(), 500);
                    });
                }
            }
        }, 1);
    }
})();

