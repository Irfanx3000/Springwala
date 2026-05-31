/**
 * sw-modal.js — Springwala Branded Modal Notification System
 * Replaces all native alert() and confirm() with premium themed modals.
 *
 * API:
 *   showModal({ type, title, message, buttonText, onClose })
 *   showConfirm({ title, message, confirmText, cancelText }) → Promise<boolean>
 */

(function () {
  'use strict';

  // ─── Inject Styles Once ───────────────────────────────────────────────────────
  if (!document.getElementById('sw-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'sw-modal-styles';
    style.textContent = `
      /* ── Springwala Modal System ── */
      @keyframes swModalFadeIn {
        from { opacity: 0; transform: scale(0.92) translateY(-8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes swModalFadeOut {
        from { opacity: 1; transform: scale(1) translateY(0); }
        to   { opacity: 0; transform: scale(0.92) translateY(-8px); }
      }

      .sw-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.52);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.22s ease;
      }
      .sw-modal-overlay.sw-modal-visible {
        opacity: 1;
      }

      .sw-modal-box {
        background: #ffffff;
        border-radius: 14px;
        padding: 32px 28px 26px;
        width: 100%;
        max-width: 430px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.10);
        font-family: 'Roboto', 'Plus Jakarta Sans', 'Inter', sans-serif;
        animation: swModalFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        text-align: center;
        position: relative;
      }

      .sw-modal-icon-wrap {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }
      .sw-modal-icon-wrap svg {
        width: 32px;
        height: 32px;
      }

      /* Type colours */
      .sw-modal-icon-wrap.sw-success { background: #dcfce7; }
      .sw-modal-icon-wrap.sw-success svg { color: #16a34a; }
      .sw-modal-icon-wrap.sw-error   { background: #fee2e2; }
      .sw-modal-icon-wrap.sw-error   svg { color: #ef4444; }
      .sw-modal-icon-wrap.sw-warning { background: #fef3c7; }
      .sw-modal-icon-wrap.sw-warning svg { color: #d97706; }
      .sw-modal-icon-wrap.sw-info    { background: #dbeafe; }
      .sw-modal-icon-wrap.sw-info    svg { color: #2563eb; }
      .sw-modal-icon-wrap.sw-confirm { background: #fef3c7; }
      .sw-modal-icon-wrap.sw-confirm svg { color: #d97706; }

      .sw-modal-title {
        font-size: 20px;
        font-weight: 700;
        color: #111827;
        margin: 0 0 10px;
        line-height: 1.3;
        font-family: 'Poppins', 'Plus Jakarta Sans', sans-serif;
      }

      .sw-modal-message {
        font-size: 14.5px;
        color: #4b5563;
        line-height: 1.65;
        margin: 0 0 26px;
        white-space: pre-line;
      }

      .sw-modal-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .sw-modal-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 28px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        outline: none;
        transition: opacity 0.18s, transform 0.18s;
        min-width: 100px;
        font-family: inherit;
        letter-spacing: 0.01em;
      }
      .sw-modal-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
      .sw-modal-btn:active { transform: scale(0.97); }

      .sw-modal-btn-primary {
        background: #C92026;
        color: #ffffff;
      }
      .sw-modal-btn-primary.sw-success { background: #16a34a; }
      .sw-modal-btn-primary.sw-error   { background: #ef4444; }
      .sw-modal-btn-primary.sw-warning { background: #d97706; }
      .sw-modal-btn-primary.sw-info    { background: #2563eb; }

      .sw-modal-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
      }
      .sw-modal-btn-secondary:hover { background: #e5e7eb; }

      .sw-modal-divider {
        width: 48px;
        height: 3px;
        border-radius: 2px;
        margin: 0 auto 18px;
      }
      .sw-modal-divider.sw-success { background: #16a34a; }
      .sw-modal-divider.sw-error   { background: #ef4444; }
      .sw-modal-divider.sw-warning { background: #d97706; }
      .sw-modal-divider.sw-info    { background: #2563eb; }
      .sw-modal-divider.sw-confirm { background: #d97706; }

      @media (max-width: 480px) {
        .sw-modal-box { padding: 24px 18px 20px; }
        .sw-modal-title { font-size: 17px; }
        .sw-modal-btn { padding: 9px 20px; font-size: 13px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── SVG Icons ────────────────────────────────────────────────────────────────
  const ICONS = {
    success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>`,
    error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>`,
    warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>`,
    info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4m0-4h.01"/>
    </svg>`,
    confirm: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <path d="M12 9v4m0 4h.01"/>
    </svg>`
  };

  // ─── Close Helper ─────────────────────────────────────────────────────────────
  function _closeModal(overlay, resolve, value) {
    overlay.style.opacity = '0';
    const box = overlay.querySelector('.sw-modal-box');
    if (box) {
      box.style.animation = 'swModalFadeOut 0.2s ease forwards';
    }
    setTimeout(() => {
      overlay.remove();
      document.removeEventListener('keydown', overlay._keyHandler);
      if (typeof resolve === 'function') resolve(value);
    }, 200);
  }

  // ─── showModal ────────────────────────────────────────────────────────────────
  /**
   * Show a branded notification modal.
   * @param {object} opts
   * @param {string} opts.type        - 'success' | 'error' | 'warning' | 'info'
   * @param {string} opts.title       - Modal heading
   * @param {string} opts.message     - Modal body text (supports newlines)
   * @param {string} [opts.buttonText] - Primary button label (default: 'Okay')
   * @param {function} [opts.onClose]  - Callback when modal is dismissed
   */
  window.showModal = function ({ type = 'info', title = '', message = '', buttonText = 'Okay', onClose } = {}) {
    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';

    const overlay = document.createElement('div');
    overlay.className = 'sw-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sw-modal-title-text');
    overlay.setAttribute('aria-describedby', 'sw-modal-message-text');

    overlay.innerHTML = `
      <div class="sw-modal-box" role="document">
        <div class="sw-modal-icon-wrap sw-${safeType}">
          ${ICONS[safeType]}
        </div>
        <div class="sw-modal-divider sw-${safeType}"></div>
        <h2 class="sw-modal-title" id="sw-modal-title-text">${_escHtml(title)}</h2>
        <p class="sw-modal-message" id="sw-modal-message-text">${_escHtml(message)}</p>
        <div class="sw-modal-actions">
          <button class="sw-modal-btn sw-modal-btn-primary sw-${safeType}" id="sw-modal-ok-btn" autofocus>
            ${_escHtml(buttonText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('sw-modal-visible'));
    });

    const focusableButtons = Array.from(overlay.querySelectorAll('button'));
    const close = () => _closeModal(overlay, onClose, undefined);

    overlay.querySelector('#sw-modal-ok-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay._keyHandler = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') { e.preventDefault(); close(); }
      if (e.key === 'Tab' && focusableButtons.length) {
        const currentIndex = focusableButtons.indexOf(document.activeElement);
        if (e.shiftKey && currentIndex === 0) {
          e.preventDefault(); focusableButtons[focusableButtons.length - 1].focus();
        } else if (!e.shiftKey && currentIndex === focusableButtons.length - 1) {
          e.preventDefault(); focusableButtons[0].focus();
        }
      }
    };
    document.addEventListener('keydown', overlay._keyHandler);

    setTimeout(() => {
      const btn = overlay.querySelector('#sw-modal-ok-btn');
      if (btn) btn.focus();
    }, 50);
  };

  window.alert = function (message) {
    window.showModal({
      type: 'info',
      title: 'Notification',
      message: String(message),
      buttonText: 'Okay'
    });
  };

  // ─── showConfirm ──────────────────────────────────────────────────────────────
  /**
   * Show a branded confirm dialog.
   * @param {object} opts
   * @param {string} opts.title         - Confirm heading
   * @param {string} opts.message       - Confirm body text
   * @param {string} [opts.confirmText] - Confirm button label (default: 'Confirm')
   * @param {string} [opts.cancelText]  - Cancel button label (default: 'Cancel')
   * @returns {Promise<boolean>} Resolves true (confirmed) or false (cancelled)
   */
  window.showConfirm = function ({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'sw-modal-overlay';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'sw-confirm-title-text');
      overlay.setAttribute('aria-describedby', 'sw-confirm-message-text');

      overlay.innerHTML = `
        <div class="sw-modal-box" role="document">
          <div class="sw-modal-icon-wrap sw-confirm">
            ${ICONS.confirm}
          </div>
          <div class="sw-modal-divider sw-confirm"></div>
          <h2 class="sw-modal-title" id="sw-confirm-title-text">${_escHtml(title)}</h2>
          <p class="sw-modal-message" id="sw-confirm-message-text">${_escHtml(message)}</p>
          <div class="sw-modal-actions">
            <button class="sw-modal-btn sw-modal-btn-secondary" id="sw-confirm-cancel-btn">${_escHtml(cancelText)}</button>
            <button class="sw-modal-btn sw-modal-btn-primary sw-error" id="sw-confirm-ok-btn" autofocus>${_escHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('sw-modal-visible'));
      });

      const buttons = Array.from(overlay.querySelectorAll('button'));
      const confirm = () => _closeModal(overlay, resolve, true);
      const cancel  = () => _closeModal(overlay, resolve, false);

      overlay.querySelector('#sw-confirm-ok-btn').addEventListener('click', confirm);
      overlay.querySelector('#sw-confirm-cancel-btn').addEventListener('click', cancel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });

      overlay._keyHandler = (e) => {
        if (e.key === 'Escape') cancel();
        if (e.key === 'Enter')  { e.preventDefault(); confirm(); }
        if (e.key === 'Tab' && buttons.length) {
          const currentIndex = buttons.indexOf(document.activeElement);
          if (e.shiftKey && currentIndex === 0) {
            e.preventDefault(); buttons[buttons.length - 1].focus();
          } else if (!e.shiftKey && currentIndex === buttons.length - 1) {
            e.preventDefault(); buttons[0].focus();
          }
        }
      };
      document.addEventListener('keydown', overlay._keyHandler);

      setTimeout(() => {
        const btn = overlay.querySelector('#sw-confirm-ok-btn');
        if (btn) btn.focus();
      }, 50);
    });
  };

  // ─── HTML Escape Helper ───────────────────────────────────────────────────────
  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
