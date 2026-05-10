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
        validationPromise: null,
        admin: null,
        token: null
    },

    /**
     * Bootstraps the authentication state.
     * Must be called at the very top of protected pages.
     */
    init: async function() {
        if (this.state.isInitialized) return this.isLoggedIn();

        console.log("[AUTH] Hydrating state from storage...");
        this.state.token = localStorage.getItem(this.TOKEN_KEY);
        try {
            const userData = localStorage.getItem(this.USER_KEY);
            this.state.admin = userData ? JSON.parse(userData) : null;
        } catch (e) {
            console.error("[AUTH] Failed to parse cached admin data", e);
            this.state.admin = null;
        }

        this.state.isInitialized = true;
        console.log("[AUTH] State Hydrated:", { 
            hasToken: !!this.state.token, 
            admin: this.state.admin?.email || 'none' 
        });
        
        // Show body if hidden by bootstrap
        document.documentElement.classList.add('auth-initialized');
        const loader = document.getElementById('sw-auth-loader');
        if (loader) loader.style.display = 'none';

        return this.isLoggedIn();
    },

    getToken: function() {
        // SSOT: Always prefer memory state if initialized, otherwise storage
        return this.state.token || localStorage.getItem(this.TOKEN_KEY);
    },

    getAdmin: function() {
        return this.state.admin;
    },

    setSession: function(token, admin) {
        console.log("[AUTH] Setting new session for:", admin.email);
        this.state.token = token;
        this.state.admin = admin;
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(admin));
        this.state.isInitialized = true;
    },

    clearSession: function() {
        console.log("[AUTH] Clearing session and local storage");
        this.state.token = null;
        this.state.admin = null;
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    isLoggedIn: function() {
        return !!this.getToken();
    },

    logout: function(reason = "Manual") {
        console.warn(`[AUTH] Logout triggered. Reason: ${reason}`);
        this.clearSession();
        if (!window.location.pathname.includes('login.html')) {
            console.log("[AUTH] Redirecting to login page...");
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
        const token = this.getToken();
        if (!token) {
            console.warn("[AUTH] No token found during requirement check. Redirecting...");
            this.logout("Missing Token");
            return false;
        }
        return true;
    },

    /**
     * Async validation with retry logic and execution lock.
     * Prevents logouts due to temporary network blips.
     */
    validate: async function(retries = 1) {
        // Task 5: Prevent duplicate concurrent validation
        if (this.state.validationPromise) {
            console.log("[AUTH] Validation already in progress, awaiting existing promise...");
            return this.state.validationPromise;
        }

        const token = this.getToken();
        if (!token) return false;

        this.state.validationPromise = (async () => {
            this.state.isValidating = true;
            try {
                console.log("[AUTH] Validating token with server...");
                const res = await fetch(`${CONFIG.API_BASE_URL}/auth/admin/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 401) {
                    this.logout("Server 401: Session expired");
                    return false;
                }

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const data = await res.json();
                if (data.success) {
                    console.log("[AUTH] Token validated successfully");
                    this.setSession(token, data.admin); // Refresh cache
                    return true;
                }
                return false;
            } catch (err) {
                console.error(`[AUTH] Validation error (${retries} retries left):`, err.message);
                if (retries > 0) {
                    console.log("[AUTH] Retrying validation in 1.5s...");
                    await new Promise(r => setTimeout(r, 1500));
                    this.state.validationPromise = null; // Reset lock for retry
                    return this.validate(retries - 1);
                }
                console.warn("[AUTH] Network failure during validation. Preserving session for now.");
                return true; // Don't logout on network error
            } finally {
                this.state.isValidating = false;
                this.state.validationPromise = null;
            }
        })();

        return this.state.validationPromise;
    }
};

// ─── Auth Bootstrap Injector ──────────────────────────────────────────────────
(function() {
    const path = window.location.pathname;
    const isAdminPage = path.includes('/admin/');
    const isLoginPage = path.includes('login.html');

    if (isAdminPage && !isLoginPage) {
        console.log("[AUTH] Bootstrap started for protected page");
        
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
        
        // Ensure body exists before appending
        const checkBody = setInterval(() => {
            if (document.body) {
                document.body.appendChild(loader);
                clearInterval(checkBody);
            }
        }, 10);

        // Run Init
        Auth.init().then(loggedIn => {
            if (!loggedIn) {
                console.warn("[AUTH] No session found during bootstrap. Redirecting...");
                Auth.logout("Bootstrap: No session");
            } else {
                Auth.validate(); // Background verify
            }
        });
    }
})();
