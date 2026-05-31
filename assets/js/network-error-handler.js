(function () {
    const ORIGIN = window.location.origin;
    const ERROR_PAGE_URL = `${ORIGIN}/error.html`;

    function isSameOriginUrl(url) {
        try {
            const parsed = new URL(url, ORIGIN);
            return parsed.origin === ORIGIN;
        } catch {
            return false;
        }
    }

    function encodeReturnUrl(returnUrl) {
        return encodeURIComponent(returnUrl);
    }

    function decodeReturnUrl(encodedUrl) {
        try {
            return decodeURIComponent(encodedUrl || '');
        } catch {
            return null;
        }
    }

    function getSafeReturnUrl(encodedUrl) {
        const decoded = decodeReturnUrl(encodedUrl);
        if (!decoded) return null;
        if (!isSameOriginUrl(decoded)) return null;
        try {
            const parsed = new URL(decoded, ORIGIN);
            if (parsed.pathname.endsWith('/error.html') || parsed.pathname === '/error.html') {
                return null;
            }
            return parsed.href;
        } catch {
            return null;
        }
    }

    function buildErrorPageUrl(type = '404', returnUrl = null) {
        const url = new URL(ERROR_PAGE_URL);
        url.searchParams.set('type', type);
        if (returnUrl) {
            url.searchParams.set('returnUrl', encodeReturnUrl(returnUrl));
        }
        return url.href;
    }

    function redirectToErrorPage(type = '404', returnUrl = window.location.href) {
        if (window.location.pathname.endsWith('/error.html') || window.location.pathname === '/error.html') {
            return;
        }
        if (window.__networkErrorRedirecting) {
            return;
        }
        window.__networkErrorRedirecting = true;
        window.location.href = buildErrorPageUrl(type, returnUrl);
    }

    function isNetworkError(error) {
        if (!error) return !navigator.onLine;
        const message = String(error.message || error || '').toLowerCase();
        return error.name === 'TypeError' || message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network') || !navigator.onLine;
    }

    function patchFetch() {
        if (typeof window.fetch !== 'function') return;
        const originalFetch = window.fetch.bind(window);
        window.fetch = async function (...args) {
            const opts = args[1] || {};
            const skipRedirect = opts.skipRedirect || (opts.headers && (opts.headers['X-Skip-Redirect'] || (typeof opts.headers.get === 'function' && opts.headers.get('X-Skip-Redirect'))));
            try {
                const res = await originalFetch(...args);
                if (window.location.pathname.endsWith('/error.html') || window.location.pathname === '/error.html') {
                    return res;
                }
                if (skipRedirect) {
                    return res;
                }
                if (res.status === 401) {
                    redirectToErrorPage('session-expired', window.location.href);
                    return res;
                }
                if (res.status === 403) {
                    redirectToErrorPage('access-denied', window.location.href);
                    return res;
                }
                if ([500, 502, 503].includes(res.status)) {
                    redirectToErrorPage('server', window.location.href);
                    return res;
                }
                return res;
            } catch (err) {
                if (window.location.protocol !== 'file:' && !skipRedirect && !window.location.pathname.endsWith('/error.html') && isNetworkError(err)) {
                    redirectToErrorPage('network', window.location.href);
                }
                throw err;
            }
        };
    }

    // Expose utilities for shared wrappers and pages.
    window.__networkErrorHandler = {
        redirectToErrorPage,
        isNetworkError,
        getSafeReturnUrl,
        buildErrorPageUrl,
    };

    patchFetch();
})();