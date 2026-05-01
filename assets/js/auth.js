/**
 * Springwala Admin — auth.js
 * Centralized authentication logic for admin panel.
 */

var Auth = window.Auth = {
    // Storage keys
    TOKEN_KEY: 'sw_admin_token',
    USER_KEY: 'sw_admin',

    getToken: function() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    getAdmin: function() {
        try {
            return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null');
        } catch {
            return null;
        }
    },

    setSession: function(token, admin) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(admin));
    },

    clearSession: function() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    isLoggedIn: function() {
        return !!this.getToken();
    },

    logout: function() {
        this.clearSession();
        window.location.href = '/admin/login.html';
    },

    /**
     * Auth Guard: Redirects to login if not authenticated.
     * Can be called synchronously for immediate check, 
     * or awaited for server-side token validation.
     */
    requireAuth: async function() {
        const token = this.getToken();

        if (!token) {
            window.location.href = '/admin/login.html';
            return false;
        }

        // Optional: Verify token with server
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/admin/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Session expired');
            
            return true;
        } catch (err) {
            console.error('Auth verification failed:', err);
            this.clearSession();
            window.location.href = '/admin/login.html';
            return false;
        }
    },

    // Sync check for stopping script execution
    requireAdminAuth: function() {
        if (!this.isLoggedIn()) {
            window.location.href = '/admin/login.html';
            return false;
        }
        return true;
    }
};

// Immediate sync check to prevent flash of protected content
(function() {
    const path = window.location.pathname;
    if (path.includes('/admin/') && !path.includes('login.html')) {
        if (!Auth.isLoggedIn()) {
            window.location.href = '/admin/login.html';
        }
    }
})();
