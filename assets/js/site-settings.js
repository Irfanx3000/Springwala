/**
 * site-settings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized site settings loader for ALL user-facing pages.
 *
 * Usage: include this script BEFORE app.js on any page.
 *
 * It will:
 *  1. Fetch /api/settings/site-configuration once per session (cached in sessionStorage)
 *  2. Apply settings to footer elements using [data-site-setting] attributes
 *  3. Expose window.SITE_SETTINGS for any script that needs it
 *
 * Footer elements must use:
 *   data-site-setting="contactPhone"   → sets textContent
 *   data-site-setting="address"        → sets textContent
 *   data-site-setting="contactEmail"   → sets textContent + href
 *   data-site-setting="logo"           → sets img src
 *   data-site-setting-href="instagram" → sets anchor href (hides if empty)
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const CACHE_KEY = 'sw_site_settings';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Production-grade URL normalizer
   * Ensures external links have protocols and are safe from relative-path bugs.
   */
  function normalizeExternalUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '' || url === '#') return '#';
    let clean = url.trim();
    
    // Safety check for dangerous protocols
    if (/^(javascript|data|vbscript):/i.test(clean)) {
      console.warn('[SiteSettings] Blocked dangerous URL:', clean);
      return '#';
    }

    // Auto-prepend protocol if missing
    if (!/^https?:\/\//i.test(clean)) {
      // Special handling for WhatsApp numbers
      if (/^\d+$/.test(clean.replace(/[+\-\s()]/g, ''))) {
        clean = `https://wa.me/${clean.replace(/[+\-\s()]/g, '')}`;
      } else {
        clean = `https://${clean}`;
      }
    }

    try {
      const u = new URL(clean);
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[SiteSettings] Normalized URL: ${url} -> ${u.href}`);
      }
      return u.href;
    } catch (e) {
      console.error('[SiteSettings] Malformed URL:', clean);
      return '#';
    }
  }

  // Hardcoded safe fallbacks — no UI crash if API is unavailable
  const FALLBACKS = {
    siteName:        'Springwala',
    contactEmail:    'support@springwala.in',
    contactNumber:   '+91 8879 241085',
    address:         'Mumbai, Maharashtra (India)',
    metaTitle:       'Springwala | Your Industrial Store',
    metaDescription: 'Leading manufacturer of high-quality industrial springs and components in India.',
    metaKeywords:    'springs, compression springs, industrial springs mumbai',
    logoUrl:         '',
    faviconUrl:      '',
    socialLinks: {
      instagram:       '',
      facebook:        '',
      linkedin:        '',
      twitter:         '',
      whatsapp:        ''
    }
  };

  function getApiBase() {
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1')
      ? 'http://localhost:5000/api'
      : `${window.location.origin}/api`;
  }

  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* storage full – silently ignore */ }
  }

  function applySettings(s) {
    window.SITE_SETTINGS = s;

    // ── Dynamic Auto-Tag Footer Social Icons ────────────────────────────────
    try {
      document.querySelectorAll('footer a').forEach(anchor => {
        const img = anchor.querySelector('img');
        if (img) {
          const src = (img.getAttribute('src') || '').toLowerCase();
          if (src.includes('facebook.svg')) {
            anchor.setAttribute('data-site-setting-href', 'facebook');
          } else if (src.includes('instagram.svg')) {
            anchor.setAttribute('data-site-setting-href', 'instagram');
          } else if (src.includes('linkedin.svg')) {
            anchor.setAttribute('data-site-setting-href', 'linkedin');
          } else if (src.includes('twitter.svg') || src.includes('x.svg')) {
            anchor.setAttribute('data-site-setting-href', 'twitter');
          } else if (src.includes('whatsapp.svg')) {
            anchor.setAttribute('data-site-setting-href', 'whatsapp');
          } else if (src.includes('pinterest.svg')) {
            anchor.setAttribute('data-site-setting-href', 'pinterest');
          }
        }
      });
    } catch (e) {
      console.warn('[SiteSettings] Social auto-tagging failed:', e);
    }

    // ── Text / link nodes ──────────────────────────────────────────────────
    document.querySelectorAll('[data-site-setting]').forEach(el => {
      const key = el.dataset.siteSetting;
      const val = s[key];
      if (!val) return;

      if (el.tagName === 'IMG') {
        // Resolve image URL against the API origin
        const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:5000'
          : window.location.origin;
        el.src = val.startsWith('http') ? val : `${base}${val}`;
        el.alt = key === 'logo' ? s.siteName : 'Favicon';
      } else if (el.tagName === 'A' && key === 'contactEmail') {
        el.textContent = val;
        el.href = `mailto:${val}`;
      } else if (el.tagName === 'A' && key === 'contactNumber') {
        el.textContent = val;
        el.href = `tel:${val.replace(/\s/g, '')}`;
      } else {
        el.textContent = val;
      }
    });

    // ── Social link anchors ────────────────────────────────────────────────
    document.querySelectorAll('[data-site-setting-href]').forEach(anchor => {
      const key = anchor.dataset.siteSettingHref;
      const rawUrl = (s.socialLinks && s.socialLinks[key] !== undefined) ? s.socialLinks[key] : s[key];
      const normalized = normalizeExternalUrl(rawUrl);

      if (normalized === '#') {
        // Safe Empty Handling: Disable interaction and mute appearance
        anchor.href = 'javascript:void(0)';
        anchor.style.opacity = '0.3';
        anchor.style.cursor = 'default';
        anchor.style.pointerEvents = 'none'; // Prevent navigation
        anchor.title = 'Link not configured';
      } else {
        anchor.style.opacity = '';
        anchor.style.cursor = '';
        anchor.style.pointerEvents = '';
        anchor.href = normalized;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log(`[Footer] Social link rendered [${key}]: ${normalized}`);
        }
      }
    });

    // ── SEO update ─────────────────────────────────────────────────────────
    if (s.metaTitle) document.title = s.metaTitle;
    
    if (s.metaDescription) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = s.metaDescription;
    }

    if (s.metaKeywords) {
      let metaKey = document.querySelector('meta[name="keywords"]');
      if (!metaKey) {
        metaKey = document.createElement('meta');
        metaKey.name = 'keywords';
        document.head.appendChild(metaKey);
      }
      metaKey.content = s.metaKeywords;
    }

    // ── Favicon update ─────────────────────────────────────────────────────
    if (s.faviconUrl) {
      const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000'
        : window.location.origin;
      const fullFaviconUrl = s.faviconUrl.startsWith('http') ? s.faviconUrl : `${base}${s.faviconUrl}`;
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = fullFaviconUrl + '?v=' + Date.now();
    }

    // ── Dynamic Google Maps Embed updates ──────────────────────────────────
    try {
      const mapIframe = document.querySelector('iframe[src*="google.com/maps"]');
      if (mapIframe && s.address) {
        mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(s.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
      }
    } catch (e) {
      console.warn('[SiteSettings] Google Map update failed:', e);
    }

    // ── Hardcoded Values & Footer Propagation ──────────────────────────────
    try {
      propagateHardcodedValues(s);
    } catch (e) {
      console.warn('[SiteSettings] Hardcoded propagation failed:', e);
    }
  }

  /**
   * Scans footer and layout elements to dynamically replace hardcoded phone, address, email,
   * and Site Name, serving as a unified dynamic skinning post-processor.
   */
  function propagateHardcodedValues(s) {
    const footers = document.querySelectorAll('footer');
    footers.forEach(footer => {
      const walk = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walk.nextNode()) {
        const text = node.nodeValue;
        
        // Match Mumbai address formats
        if (text.includes('Mumbai, Maharashtra (India)')) {
          node.nodeValue = text.replace('Mumbai, Maharashtra (India)', s.address);
        } else if (text.includes('Springwala Industrial Park, Wagle Estate, Thane West, Mumbai, Maharashtra 400604, India')) {
          node.nodeValue = text.replace('Springwala Industrial Park, Wagle Estate, Thane West, Mumbai, Maharashtra 400604, India', s.address);
        }
        
        // Match hardcoded phone text
        if (text.includes('+91 8879 241085')) {
          node.nodeValue = text.replace('+91 8879 241085', s.contactNumber);
        } else if (text.includes('+91 8879241085')) {
          node.nodeValue = text.replace('+91 8879241085', s.contactNumber);
        }
        
        // Match hardcoded email text
        if (text.includes('support@springwala.in')) {
          node.nodeValue = text.replace('support@springwala.in', s.contactEmail);
        }
        
        // Match copyright and text headings
        if (text.includes('Springwala')) {
          if (node.parentElement && node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
            node.nodeValue = text.replace(/Springwala/g, s.siteName);
          }
        }
      }

      // Update href attributes of links inside the footer
      footer.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        
        // Defuse Cloudflare email protection or obfuscated links
        if (a.classList.contains('__cf_email__') || href.includes('email-protection') || a.textContent.includes('[email')) {
          a.href = `mailto:${s.contactEmail}`;
          a.textContent = s.contactEmail;
          a.removeAttribute('data-cfemail');
          a.className = a.className.replace('__cf_email__', '');
        }
        
        if (href.includes('mailto:support@springwala.in') || href.includes('mailto:') && a.textContent.includes(s.contactEmail)) {
          a.href = `mailto:${s.contactEmail}`;
        }
        if (href.includes('tel:+918879241085') || href.includes('tel:') && a.textContent.includes(s.contactNumber)) {
          a.href = `tel:${s.contactNumber.replace(/\s/g, '')}`;
        }
      });
    });

    // Also update any dynamic header support numbers, headings, or anchors
    document.querySelectorAll('.user-first-name, #selected-category-text, h3, p, span, a').forEach(el => {
      if (el.dataset.siteSetting) return; // handled by main logic
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        
        // Defuse Cloudflare email protection or obfuscated links outside footers if any
        if (el.classList.contains('__cf_email__') || href.includes('email-protection') || el.textContent.includes('[email')) {
          el.href = `mailto:${s.contactEmail}`;
          el.textContent = s.contactEmail;
          el.removeAttribute('data-cfemail');
          el.className = el.className.replace('__cf_email__', '');
        }
        
        if (href.includes('mailto:support@springwala.in')) {
          el.href = `mailto:${s.contactEmail}`;
        }
        if (href.includes('tel:+918879241085') || href.includes('tel:+918879241085')) {
          el.href = `tel:${s.contactNumber.replace(/\s/g, '')}`;
        }
      }
      
      const text = el.textContent || '';
      if (text.includes('support@springwala.in')) {
        el.textContent = text.replace('support@springwala.in', s.contactEmail);
      }
      if (text.includes('+91 8879 241085')) {
        el.textContent = text.replace('+91 8879 241085', s.contactNumber);
      }
    });
  }

  async function loadSettings() {
    // 1. Try cache first — instant apply, no flicker
    const cached = getCached();
    if (cached) { applySettings(cached); return; }

    // 2. Fetch from API
    try {
      const res = await fetch(`${getApiBase()}/settings/site-configuration`);
      if (!res.ok) throw new Error('settings api failed');
      const json = await res.json();
      if (json.success && json.settings) {
        const merged = Object.assign({}, FALLBACKS, json.settings);
        setCache(merged);
        applySettings(merged);
      } else {
        applySettings(FALLBACKS);
      }
    } catch (err) {
      console.warn('[SiteSettings] Using fallbacks:', err.message);
      applySettings(FALLBACKS);
    }
  }

  // Run after DOM is ready — non-blocking, no layout shift
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
  } else {
    loadSettings();
  }

  // Expose for external use (e.g. app.js can call window.SITE_SETTINGS)
  window.loadSiteSettings = loadSettings;

})();
