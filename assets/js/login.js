/**
 * login.js — Admin Login Controller (Production Refactored)
 * Handles authentication for the administrative dashboard.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial State Check
  // If already logged in, skip login page and go directly to dashboard
  if (Auth.isLoggedIn()) {
    window.location.href = '/admin/dashboard.html';
    return;
  }

  // 2. Element Selectors
  const form      = document.getElementById('login-form');
  const emailEl   = document.getElementById('login-email');
  const passEl    = document.getElementById('login-password');
  const btnEl     = document.getElementById('login-btn');
  const errorEl   = document.getElementById('login-error');
  const toggleBtn = document.getElementById('toggle-password');
  const eyeIcon   = document.getElementById('eye-icon');

  // 3. Password Toggle Logic
  if (toggleBtn && passEl) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = passEl.type === 'password';
      passEl.type = isHidden ? 'text' : 'password';
      if (eyeIcon) eyeIcon.style.opacity = isHidden ? '1' : '0.7';
    });
  }

  // 4. Form Submission Handler
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = emailEl?.value?.trim();
    const password = passEl?.value;

    // Client-side validation before hitting API
    if (!email || !isValidEmail(email)) { 
      showError('Please enter a valid admin email address.'); 
      emailEl?.focus(); 
      return; 
    }
    if (!password || password.length < 4) { 
      showError('Please enter your administrator password.'); 
      passEl?.focus(); 
      return; 
    }

    setLoading(true);
    clearError();

    try {
      // Production API call via centralized api utility
      const data = await api.post('/auth/admin/login', { email, password });

      if (data?.token && data?.admin) {
        // Persist session only after successful authentication
        Auth.setSession(data.token, data.admin);
        
        // Success feedback and transition
        showToast(`Authentication successful. Redirecting...`, 'success');
        
        // Short delay to allow toast visibility
        setTimeout(() => { 
          window.location.href = '/admin/dashboard.html'; 
        }, 800);
      } else {
        showError('Invalid server response. Please contact support.');
      }
    } catch (err) {
      // Systematic error mapping based on backend responses
      const msg = err.message || 'Authentication service is unavailable.';
      
      if (msg.includes('credentials') || msg.includes('password') || msg.includes('Invalid')) {
        showError('Incorrect email or password. Please try again.');
      } else if (msg.includes('deactivated') || msg.includes('inactive')) {
        showError('This admin account has been deactivated.');
      } else if (msg.includes('server') || msg.includes('port 5000')) {
        showError('Unable to connect to the administration server.');
      } else {
        showError('Login failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  });

  // 5. Utility Functions
  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    } else {
      showToast(msg, 'error');
    }
  }

  function clearError() {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function setLoading(loading) {
    if (!btnEl) return;
    btnEl.disabled = loading;
    btnEl.textContent = loading ? 'Authenticating...' : 'Login';
    btnEl.style.opacity = loading ? '0.7' : '1';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});
