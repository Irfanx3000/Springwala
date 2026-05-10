/**
 * assets/js/login.js
 * Logic for the Admin Authentication & Approval System
 */

document.addEventListener('DOMContentLoaded', () => {
    initAuthHandlers();
    checkAdminState();
});

function initAuthHandlers() {
    // 1. Login Handler
    const loginBtn = document.getElementById('btn-login-submit');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();

            if (!email || !password) return showError('Please enter both email and password');

            setLoading(loginBtn, true);
            try {
                const res = await api.post('/admin/login', { email, password });
                if (res.success) {
                    Auth.setSession(res.token, res.admin);
                    showToast('Login successful! Redirecting...', 'success');
                    
                    // Instant redirect
                    window.location.href = '/admin/dashboard.html';
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(loginBtn, false);
            }
        });
    }

    // 1.2 OTP Login (Existing Admin) - Send OTP
    const sendLoginOtpBtn = document.getElementById('btn-send-login-otp');
    if (sendLoginOtpBtn) {
        sendLoginOtpBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-otp-email').value.trim();
            if (!email) return showError('Please enter your email');

            setLoading(sendLoginOtpBtn, true);
            try {
                const res = await api.post('/admin/send-login-otp', { email });
                if (res.success) {
                    showToast('OTP sent to your email');
                    document.getElementById('otp-login-email-step').classList.add('hidden');
                    document.getElementById('otp-login-verify-step').classList.remove('hidden');
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(sendLoginOtpBtn, false);
            }
        });
    }

    // 1.3 OTP Login (Existing Admin) - Verify OTP
    const verifyLoginOtpBtn = document.getElementById('btn-verify-login-otp');
    if (verifyLoginOtpBtn) {
        verifyLoginOtpBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-otp-email').value.trim();
            const otp = document.getElementById('login-otp-input').value.trim();

            if (!otp || otp.length !== 6) return showError('Enter a valid 6-digit OTP');

            setLoading(verifyLoginOtpBtn, true);
            try {
                const res = await api.post('/admin/verify-login-otp', { email, otp });
                if (res.success) {
                    Auth.setSession(res.token, res.admin);
                    showToast('Login successful!', 'success');
                    
                    // Instant redirect
                    window.location.href = '/admin/dashboard.html';
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(verifyLoginOtpBtn, false);
            }
        });
    }

    // 2. Request Access Handler
    const requestBtn = document.getElementById('btn-request-submit');
    if (requestBtn) {
        requestBtn.addEventListener('click', async () => {
            const name = document.getElementById('request-name').value.trim();
            const email = document.getElementById('request-email').value.trim();

            if (!name || !email) return showError('Please enter both name and email');

            setLoading(requestBtn, true);
            try {
                const res = await api.post('/admin/request-access', { name, email });
                if (res.success) {
                    localStorage.setItem('adminEmail', email);
                    showToast('Request submitted successfully!', 'success');
                    switchState('pending');
                } else {
                    // If already approved/verified, try to resume onboarding
                    if (res.message.toLowerCase().includes('approved') || res.message.toLowerCase().includes('verified')) {
                        localStorage.setItem('adminEmail', email);
                        checkAdminState();
                    } else {
                        showError(res.message);
                    }
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(requestBtn, false);
            }
        });
    }

    // 3. Check Status Handler
    const checkBtn = document.getElementById('btn-check-status');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkAdminState);
    }

    // 4. Verify OTP Handler
    const verifyBtn = document.getElementById('btn-verify-otp');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const otp = document.getElementById('otp-input').value.trim();
            const email = localStorage.getItem('adminEmail');

            if (!otp || otp.length !== 6) return showError('Enter a valid 6-digit OTP');

            setLoading(verifyBtn, true);
            try {
                const res = await api.post('/admin/verify-onboarding-otp', { email, otp });
                if (res.success) {
                    showToast('OTP Verified!', 'success');
                    switchState('password');
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(verifyBtn, false);
            }
        });
    }

    // 5. Resend OTP Handler
    const resendBtn = document.getElementById('btn-resend-otp');
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = localStorage.getItem('adminEmail');
            setLoading(resendBtn, true);
            try {
                const res = await api.post('/admin/send-onboarding-otp', { email });
                if (res.success) {
                    showToast('OTP resent to your email');
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(resendBtn, false);
            }
        });
    }

    // 6. Set Password Handler
    const setPassBtn = document.getElementById('btn-set-password');
    if (setPassBtn) {
        setPassBtn.addEventListener('click', async () => {
            const password = document.getElementById('new-password').value.trim();
            const confirm = document.getElementById('confirm-password').value.trim();
            const email = localStorage.getItem('adminEmail');

            if (password.length < 6) return showError('Password must be at least 6 characters');
            if (password !== confirm) return showError('Passwords do not match');

            setLoading(setPassBtn, true);
            try {
                const res = await api.post('/admin/set-password', { email, password });
                if (res.success) {
                    showToast('Setup complete! Please login.', 'success');
                    localStorage.removeItem('adminEmail');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showError(res.message);
                }
            } catch (err) {
                showError(err.message);
            } finally {
                setLoading(setPassBtn, false);
            }
        });
    }
}

/**
 * Persistently check onboarding state
 */
async function checkAdminState() {
    const email = localStorage.getItem('adminEmail');
    if (!email) return;

    // Show loading state if it's a direct state check
    const checkBtn = document.getElementById('btn-check-status');
    if (checkBtn) setLoading(checkBtn, true);

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/admin/request-status?email=${email}`);
        const data = await res.json();

        if (!data.success) {
            // Request might have been deleted or email is wrong
            localStorage.removeItem('adminEmail');
            switchState('entry');
            return;
        }

        switch (data.status) {
            case 'pending':
                switchState('pending');
                break;
            case 'approved':
                // Automatically send OTP first time they land here
                switchState('otp');
                // We can optionally call send-otp here if we want to automate it
                break;
            case 'verified':
                switchState('password');
                break;
            case 'completed':
                localStorage.removeItem('adminEmail');
                showToast('Registration complete! Redirecting to login...', 'success');
                setTimeout(() => window.location.reload(), 1500);
                break;
            case 'rejected':
                switchState('rejected');
                break;
            default:
                switchState('entry');
        }
    } catch (err) {
        console.error('State check failed:', err);
    } finally {
        if (checkBtn) setLoading(checkBtn, false);
    }
}

// Helpers
function showError(msg) {
    const errEl = document.getElementById('auth-error');
    if (!errEl) return;
    errEl.innerText = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 5000);
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<div class="loader"></div> Processing...';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
}
