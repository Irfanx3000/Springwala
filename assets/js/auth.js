/**
 * Springwala Admin — auth.js (Production-Safe Version)
 * NO infinite loops. NO body hiding. NO race conditions.
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

    init: function () {
        if (this.state.isInitialized) return this.isLoggedIn();
        this.state.token = localStorage.getItem(this.TOKEN_KEY);
        try {
            const userData = localStorage.getItem(this.USER_KEY);
            this.state.admin = userData ? JSON.parse(userData) : null;
        } catch (e) {
            this.state.admin = null;
        }
        this.state.isInitialized = true;
        return this.isLoggedIn();
    },

    getToken: function () {
        return this.state.token || localStorage.getItem(this.TOKEN_KEY);
    },

    getAdmin: function () {
        return this.state.admin;
    },

    setSession: function (token, admin) {
        this.state.token = token;
        this.state.admin = admin;
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(admin));
        this.state.isInitialized = true;
    },

    clearSession: function () {
        this.state.token = null;
        this.state.admin = null;
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    isLoggedIn: function () {
        return !!this.getToken();
    },

    logout: function (reason) {
        console.warn('[AUTH] Logout:', reason || 'Manual');
        this.clearSession();
        if (!window.location.pathname.includes('login')) {
            window.location.href = '/admin/login.html';
        }
    },

    requireAuth: function () {
        return this.requireAdminAuth();
    },

    requireAdminAuth: function () {
        if (!this.getToken()) {
            this.logout("Session missing");
            return false;
        }
        return true;
    },

    validate: async function () {
        if (this.state.isValidating) return;
        const token = this.getToken();
        if (!token) return false;

        this.state.isValidating = true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function() { controller.abort(); }, 8000);

            const res = await fetch(CONFIG.API_BASE_URL + '/auth/admin/me', {
                headers: { 'Authorization': 'Bearer ' + token },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

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
            console.warn('[AUTH] Validate failed:', err.message);
            return true;
        } finally {
            this.state.isValidating = false;
        }
    }
};

// Simple bootstrap - waits for DOM properly, no polling
(function () {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login');
    const isAdminPage = path.includes('/admin');

    if (!isAdminPage || isLoginPage) return;

    function bootstrap() {
        const loggedIn = Auth.init();
        if (!loggedIn) {
            Auth.logout("Bootstrap: No session");
        } else {
            setTimeout(function() { Auth.validate(); }, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();

