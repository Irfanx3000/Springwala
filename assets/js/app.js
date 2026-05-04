/**
 * Springwala Frontend Integration — app.js
 * Shared across all pages. Handles:
 *  - Auth state (token, user data)
 *  - Header personalisation (firstName, location)
 *  - Cart badge & Add-to-Cart functionality
 *  - Geolocation
 *  - Product rendering helpers
 *  - Mobile menu
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ─── API Configuration ────────────────────────────────────────────────────────
var API_BASE = CONFIG.API_BASE_URL;
var BASE_URL = CONFIG.IMAGE_BASE_URL;
var IMAGE_BASE = CONFIG.IMAGE_BASE_URL;

// ─── Pricing Engine ───────────────────────────────────────────────────────────
const Pricing = {
  /**
   * Pricing Engine (Frontend)
   * Single Source of Truth: backend pre-calculated product.finalPrice
   */
  calculate: (product, quantity = 1, selectedBatch = null) => {
    const isBatchProduct = product.batches && product.batches.length > 0;
    const discount = parseFloat(product.discountPercent) || 0;

    // Use backend finalPrice if available, otherwise calculate fallback
    let finalPrice = parseFloat(product.finalPrice);
    if (isNaN(finalPrice)) {
      // Fallback for older products
      const base = parseFloat(product.price || product.basePrice || 0) || 0;
      const gst = parseFloat(product.gstPercent || 0) || 0;
      const afterDiscount = base * (1 - discount / 100);
      finalPrice = afterDiscount * (1 + gst / 100) || 0;
    }

    let batch = "N/A";
    let hsn = product.hsn || product.hsnCode || "N/A";

    if (isBatchProduct) {
      const b = selectedBatch || (product.batches && product.batches.length > 0 ? product.batches[0] : null);
      if (b) {
        // For batches, the price in DB is currently the 'base' price
        const bBase = parseFloat(b.price) || 0;
        const gst = parseFloat(product.gstPercent || 0);
        finalPrice = (bBase * (1 - discount / 100)) * (1 + gst / 100);
        batch = b.quantity ? `Pack of ${b.quantity}` : "N/A";
      }
    }

    const subtotal = finalPrice * quantity;
    const unitsPerPack = isBatchProduct ? (selectedBatch || (product.batches && product.batches.length > 0 ? product.batches[0] : { quantity: 1 })).quantity || 1 : 1;
    const perUnitPrice = finalPrice / unitsPerPack;

    return {
      quantity,
      batch,
      hsn,
      finalPrice: Number(finalPrice || 0),
      perUnitPrice: Number(perUnitPrice || 0),
      discount,
      gst: 0,
      deliveryCharges: 0,
      subtotal: Number((finalPrice * quantity).toFixed(2))
    };
  }
};


// ─── Auth Helpers ─────────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('token'),
  setToken: (t) => {
    localStorage.setItem('token', t);
  },
  clearToken: () => {
    localStorage.removeItem('token');
  },
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch { return null; }
  },
  setUser: (u) => {
    localStorage.setItem('user', JSON.stringify(u));
  },
  clearUser: () => {
    localStorage.removeItem('user');
  },
  isLoggedIn: () => !!localStorage.getItem('token'),
  logout: () => {
    // Clear all auth and user data
    const keysToRemove = [
      'token', 'userToken', 'user', 'springwalaUser',
      'cart', 'userProfileImage', 'redirectAfterLogin'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear all session storage
    sessionStorage.clear();

    window.location.href = 'index.html';
  }
};

/**
 * GLOBAL AUTH VALIDATION
 * Validates user with backend on every page load to ensure state sync.
 */
async function validateUser() {
  const token = Auth.getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Session expired or user deleted");
      throw new Error("Validation failed");
    }

    const data = await res.json();
    if (data.user) {
      Auth.setUser(data.user);
      updateHeaderUser(data.user); // Restore UI update
      console.log("[Auth] Session validated successfully.");
    }
  } catch (err) {
    console.warn("Auth validation failed:", err.message);
    // ONLY logout if it's a definitive auth failure (401)
    if (err.message.includes('expired') || err.message.includes('401') || err.message.includes('Unauthorized')) {
      console.error('[Auth] Unauthorized access - clearing session');
      Auth.logout();
    }
  }
}

// Authentication helper for cart gating
function isUserLoggedIn() {
  return Auth.isLoggedIn();
}

// ─── API Helper ───────────────────────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', body = null, auth = false) {
  const url = API_BASE + endpoint;
  console.log(`[API] Fetching: ${url} (${method})`);
  console.log("Fetching products..."); // Specific log as requested by user

  const token = localStorage.getItem("token");
  const isProtected = auth || endpoint.includes('/user/') || endpoint.includes('/payment/');

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  } else if (isProtected) {
    console.warn(`[API-WARN] Protected route requested but token is null: ${endpoint}`);
  }

  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    console.log(`[API-TRACE] Response received with status: ${res.status}`);

    if (res.status === 401 && isProtected) {
      console.error('[API] 401 Unauthorized - Session expired');
      Auth.logout();
      throw new Error('Session expired. Please login again.');
    }

    const data = await res.json();
    console.log(`[API-TRACE] JSON parsed successfully:`, data);

    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    console.error(`[API-TRACE] Fetch/Parse Error for ${endpoint}:`, err);
    throw err;
  }
}

/**
 * UTILITY: Navigate to Profile or Login
 * Shared by both mobile and desktop nav elements.
 */
function navigateToAccount() {
  const token = Auth.getToken();
  console.log("User clicked profile/account");
  console.log("Token exists:", !!token);

  if (token) {
    window.location.href = "profile.html";
  } else {
    window.location.href = "login.html";
  }
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
const Cart = {
  // Returns local guest cart array
  getGuestCart: () => { try { return JSON.parse(localStorage.getItem('guestCart') || '[]'); } catch { return []; } },
  saveGuestCart: (items) => {
    localStorage.setItem('guestCart', JSON.stringify(items));
    Cart.updateBadge();
  },
  clearGuestCart: () => {
    localStorage.removeItem('guestCart');
    Cart.updateBadge();
  },

  // Hybrid get: returns guest items or server items (if cached/provided)
  get: () => {
    if (!Auth.isLoggedIn()) return Cart.getGuestCart();
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  },

  save: (items) => {
    localStorage.setItem('cart', JSON.stringify(items));
    Cart.updateBadge();
  },

  // Add item
  async add(productId, name, image, finalPrice, quantity = 1, batchQuantity = 1) {
    const unitPrice = Number(finalPrice);
    if (!Auth.isLoggedIn()) {
      const items = Cart.getGuestCart();
      const bQty = Number(batchQuantity || 1);

      const idx = items.findIndex(i => i.productId === productId && i.batchQuantity === bQty);
      if (idx > -1) {
        items[idx].quantity += quantity;
      } else {
        items.push({
          productId,
          quantity,
          batchQuantity: bQty,
          finalPrice: unitPrice,
          nameSnapshot: name,
          imageSnapshot: image,
        });
      }
      Cart.saveGuestCart(items);
      showToast('Added to guest cart!', 'success');
    } else {
      try {
        const res = await apiCall('/user/cart/add', 'POST', {
          productId,
          quantity,
          batchQuantity: Number(batchQuantity || 1),
          finalPrice: unitPrice
        }, true);
        if (res.success) {
          showToast('Added to cart!', 'success');
          Cart.updateBadge();
          if (typeof renderCart === 'function' && window.location.pathname.includes('cart.html')) renderCart();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  },

  async remove(productId) {
    if (!Auth.isLoggedIn()) {
      const items = Cart.getGuestCart().filter(i => i.productId !== productId);
      Cart.saveGuestCart(items);
    } else {
      try {
        // Logged-in remove (uses cart item ID usually, but backend handles productId if needed)
        // If your backend uses productId for remove, otherwise we need to find itemId
        // Our controller uses req.params.itemId. We'll need to handle that in renderCart.
        // For simplicity, let's assume we pass the itemId if we have it, else use productId.
        const res = await apiCall(`/user/cart/${productId}`, 'DELETE', null, true);
        if (res.success) {
          Cart.updateBadge();
          if (typeof renderCart === 'function' && window.location.pathname.includes('cart.html')) renderCart();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  },

  async updateQty(productId, qty) {
    if (qty <= 0) { await Cart.remove(productId); return; }
    if (!Auth.isLoggedIn()) {
      const items = Cart.getGuestCart();
      const idx = items.findIndex(i => i.productId === productId);
      if (idx > -1) {
        items[idx].quantity = qty;
        Cart.saveGuestCart(items);
        if (typeof renderCart === 'function' && window.location.pathname.includes('cart.html')) renderCart();
      }
    } else {
      try {
        const res = await apiCall(`/user/cart/${productId}`, 'PUT', { quantity: qty }, true);
        if (res.success) {
          Cart.updateBadge();
          if (typeof renderCart === 'function' && window.location.pathname.includes('cart.html')) renderCart();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  },

  async mergeGuestCart() {
    const guestItems = Cart.getGuestCart();
    if (!guestItems.length) return;

    console.log('🔄 Merging guest cart...');
    try {
      // Step 2: For each item in guestCart, POST to add
      for (const item of guestItems) {
        await apiCall('/user/cart/add', 'POST', {
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId || null
        }, true);
      }

      // Step 3: Clear guestCart from localStorage
      Cart.clearGuestCart();
      console.log('✅ Guest cart merged successfully');

      // Step 4: Refresh UI + badge
      Cart.updateBadge();
      if (typeof renderCart === 'function' && window.location.pathname.includes('cart.html')) renderCart();

    } catch (err) {
      console.error('❌ Cart merge failed:', err);
    }
  },

  count: () => {
    if (!Auth.isLoggedIn()) return Cart.getGuestCart().reduce((s, i) => s + i.quantity, 0);
    const serverCart = Cart.get(); // Relies on loadCartCount to keep this updated
    return serverCart.reduce((s, i) => s + i.quantity, 0);
  },

  totals: () => calculateCartTotals(Cart.get()),

  updateBadge() {
    loadCartCount();
  }
};

// ─── Wishlist ─────────────────────────────────────────────────────────────────
const Wishlist = {
  items: [], // Array of product IDs (strings)

  get: () => {
    if (!Auth.isLoggedIn()) {
      try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch { return []; }
    }
    try { return JSON.parse(localStorage.getItem('wishlist_cache') || '[]'); } catch { return []; }
  },

  async sync() {
    this.items = this.get().map(String);
    this.updateUI();

    if (Auth.isLoggedIn()) {
      try {
        const data = await apiCall('/user/wishlist', 'GET', null, true);
        console.log("Wishlist API Response:", data);
        if (data.success) {
          this.items = (data.products || [])
            .map(p => String(p._id || p))
            .filter(id => id && id !== 'undefined' && id !== 'null' && id !== '[object Object]');
          localStorage.setItem('wishlist_cache', JSON.stringify(this.items));
          this.updateUI();
        }
      } catch (err) {
        console.warn('[Wishlist] Sync failed:', err.message);
      }
    }
    this.updateBadge();
  },

  async toggle(productId, btn) {
    if (!productId) return;
    const pid = String(productId);

    const isCurrentlyIn = this.items.includes(pid);

    // 1. OPTIMISTIC UPDATE: Update state immediately
    if (isCurrentlyIn) {
      this.items = this.items.filter(id => id !== pid);
    } else {
      if (!this.items.includes(pid)) this.items.push(pid);
    }

    // Immediate UI feedback
    if (btn) this.updateIcon(pid, btn);
    this.updateUIForProduct(pid);
    this.updateBadge();

    if (Auth.isLoggedIn()) {
      try {
        const res = await apiCall('/user/wishlist/toggle', 'POST', { productId: pid }, true);
        if (res.success) {
          localStorage.setItem('wishlist_cache', JSON.stringify(this.items));
          showToast(res.action === 'added' ? 'Added to Wishlist' : 'Removed from Wishlist', res.action === 'added' ? 'success' : 'info');
        } else {
          throw new Error(res.message || 'Operation failed');
        }
      } catch (err) {
        // Rollback on error
        console.error('[Wishlist] Toggle error, rolling back:', err.message);
        if (isCurrentlyIn) {
          if (!this.items.includes(pid)) this.items.push(pid);
        } else {
          this.items = this.items.filter(id => id !== pid);
        }
        if (btn) this.updateIcon(pid, btn);
        this.updateUIForProduct(pid);
        this.updateBadge();
        showToast(err.message, 'error');
      }
    } else {
      // Guest logic
      localStorage.setItem('wishlist', JSON.stringify(this.items));
      showToast(isCurrentlyIn ? 'Removed from Wishlist' : 'Added to Wishlist', isCurrentlyIn ? 'info' : 'success');
    }
    // Handle page re-render if on wishlist page
    if (document.body.dataset.page === 'wishlist') {
      if (typeof initWishlistPage === 'function') initWishlistPage();
    }
  },

  updateBadge() {
    const count = this.items.length;
    document.querySelectorAll('.wishlist-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  updateIcon(productId, btn) {
    if (!btn) return;
    const pid = String(productId);
    const isIn = this.items.map(String).includes(pid);
    const img = btn.querySelector('img');
    if (img) {
      img.src = isIn ? 'assets/icons/mobile/star-gold.svg' : 'assets/icons/mobile/star.svg';
    }
    btn.classList.toggle('active', isIn);
  },

  updateUIForProduct(productId) {
    const pid = String(productId);
    // Find by data attribute (more reliable) or onclick content
    document.querySelectorAll(`[data-product-id="${pid}"], [onclick*="${pid}"]`).forEach(btn => {
      if (btn.classList.contains('fo-wishlist') || btn.classList.contains('product-wishlist-btn')) {
        this.updateIcon(pid, btn);
      }
    });
  },

  updateUI() {
    this.items.forEach(id => this.updateUIForProduct(id));
    // Also reset those NOT in wishlist
    document.querySelectorAll('button[onclick*="toggleWishlist"]').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/'([^']+)'/);
      if (match && match[1]) this.updateIcon(match[1], btn);
    });
  }
};

// Handle Token from URL (Google OAuth)
(function handleUrlToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    localStorage.setItem("token", token);
    // Remove token from URL for clean look
    window.history.replaceState({}, document.title, window.location.pathname);
    console.log("✅ Google Auth Token stored successfully");
    // Merge guest cart if any
    // Auto-migrate legacy cart data to ensure finalPrice exists
    try {
      ['cart', 'guestCart'].forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const items = JSON.parse(raw);
          const migrated = items.map(item => ({
            ...item,
            finalPrice: Number(item.finalPrice || item.price || item.pricePerUnit || 0)
          }));
          localStorage.setItem(key, JSON.stringify(migrated));
        }
      });
    } catch (e) { console.warn("Cart migration failed:", e); }

    setTimeout(() => {
      if (typeof Cart !== 'undefined' && Cart.mergeGuestCart) Cart.mergeGuestCart();
    }, 800);
  }
})();

/**
 * GLOBAL CART COUNT FETCH
 * Fetches cart from backend and updates all badges.
 */
async function loadCartCount() {
  let count = 0;

  if (Auth.isLoggedIn()) {
    try {
      const data = await apiCall('/user/cart', 'GET', null, true);
      // Map server items to match our local structure for Cart.get()
      const mappedItems = (data.cart?.items || []).map(item => ({
        productId: item.product?._id || item.product,
        itemId: item._id,
        name: item.name,
        image: item.image,
        finalPrice: Number(item.finalPrice || item.pricePerUnit || 0) || 0,
        quantity: item.quantity,
        batchQuantity: item.batchQuantity || 1,
      }));

      // Cache server cart in 'cart' key
      localStorage.setItem('cart', JSON.stringify(mappedItems));
      count = mappedItems.reduce((s, i) => s + i.quantity, 0);
    } catch (err) {
      console.warn('Failed to load cart count:', err);
      // Fallback to cached cart if API fails
      count = JSON.parse(localStorage.getItem('cart') || '[]').reduce((s, i) => s + i.quantity, 0);
    }
  } else {
    // Guest mode
    count = Cart.getGuestCart().reduce((s, i) => s + i.quantity, 0);
  }

  document.querySelectorAll('.cart-badge, .cart-count').forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

function calculateCartTotals(cart) {
  let itemsTotal = 0;
  let totalQuantity = 0;

  cart.forEach(item => {
    const unitPrice = Number(item.finalPrice || item.price || item.pricePerUnit || 0) || 0;
    const qty = Number(item.quantity || 1) || 0;
    itemsTotal += unitPrice * qty;
    totalQuantity += qty;
  });

  // Basic fallback calculation
  const deliveryCharge = itemsTotal < 1000 && itemsTotal > 0 ? 120 : 0;
  const totalPayable = itemsTotal + deliveryCharge;

  return {
    itemCount: cart.length,
    totalQuantity,
    itemsTotal,
    deliveryCharge,
    totalPayable
  };
}

// ─── Image helper ─────────────────────────────────────────────────────────────
function goBackToCart() {
  if (document.referrer.includes("cart")) {
    window.history.back();
  } else {
    window.location.href = "cart.html";
  }
}

function getImageUrl(image) {
  if (!image || image === "" || image === "undefined" || image === "null") {
    return "assets/images/deafult.png";
  }

  if (image.startsWith("http")) {
    return image;
  }

  // Ensure leading slash if not present and not starting with http
  const path = image.startsWith('/') ? image : '/' + image;
  
  // If it's already a full assets path, return it
  if (image.startsWith('assets/')) return image;

  return `${IMAGE_BASE}${path}`;
}

function productImg(product) {
  const img = product?.images?.[0] || product?.image;
  return getImageUrl(img);
}

// ─── Product Card HTML ────────────────────────────────────────────────────────
function buildProductCard(p, className = '', showRemove = false) {
  const pricing = Pricing.calculate(p);
  const finalPrice = Number(pricing.finalPrice || 0);
  const basePrice = Number(p.basePrice || p.price || finalPrice);
  const discount = Number(pricing.discount || 0);

  const img = productImg(p);
  const link = `product.html?id=${p._id}`;
  const isOutOfStock = (p.stock || 0) <= 0;
  const isInWishlist = Wishlist.items.includes(String(p._id));

  const catSlug = p.category?.name ? p.category.name.toLowerCase().replace(/\s+/g, '-') : '';

  return `
    <div class="fo-card product-card ${className} ${isOutOfStock ? 'opacity-75' : ''}" data-product-id="${p._id}" data-price="${finalPrice}" data-category="${catSlug}">
      ${isOutOfStock ? `<span class="fo-badge !bg-gray-600 !text-white">OUT OF STOCK</span>` : (discount > 0 ? `<span class="fo-badge">Save ${discount}%</span>` : '')}
      <a href="${isOutOfStock ? '#' : link}" class="fo-image-box ${isOutOfStock ? 'pointer-events-none' : ''}">
        <img src="${img}" alt="${p.name}" onerror="this.onerror=null; this.src='assets/images/deafult.png';">
        ${!isOutOfStock ? `
        <button class="fo-wishlist ${isInWishlist ? 'active' : ''}" data-product-id="${p._id}" onclick="event.preventDefault();toggleWishlist('${p._id}',this)">
          <img src="assets/icons/mobile/${isInWishlist ? 'star-gold.svg' : 'star.svg'}" alt="Wishlist" class="w-6 h-6 wishlist-icon">
        </button>` : ''}
      </a>
      <div class="fo-details">
        <a href="${isOutOfStock ? '#' : link}" class="fo-prod-name ${isOutOfStock ? 'pointer-events-none' : ''}">${p.name}</a>
        <div class="fo-pricing">
          <span class="fo-price">₹${finalPrice.toFixed(2)}</span>
          ${basePrice > finalPrice ? `<span class="fo-old-price">₹${basePrice.toFixed(2)}</span>` : ''}
        </div>
        ${isOutOfStock ? `
        <button class="fo-cart-btn !bg-gray-400 cursor-not-allowed" disabled>
          Out of Stock
        </button>` : `
        <button class="fo-cart-btn" onclick="addToCartFromCard('${p._id}','${p.name.replace(/'/g, "\\'")}','${img}',${finalPrice},${pricing.unitsPerPack},this)">
          Add to Cart <img src="assets/icons/mobile/addtocart.svg" alt="Cart" class="w-4 h-4 ml-2">
        </button>`}
        ${showRemove ? `
        <button class="w-full mt-2 py-2 text-[13px] font-bold text-[#BE2229] border border-[#BE2229] rounded-[6px] hover:bg-red-50 transition" onclick="event.preventDefault();toggleWishlist('${p._id}')">
          Remove Item
        </button>` : ''}
      </div>
    </div>`;
}

function addToCartFromCard(productId, name, image, finalPrice, batchQuantity = 1, btn) {
  Cart.add(productId, name, image, finalPrice, 1, batchQuantity);

  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Added';
    btn.style.background = '#2E7D32';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1500);
  }
}

// ─── Wishlist toggle (visual only; extend with API if needed) ─────────────────
function toggleWishlist(productId, btn) {
  const img = btn.querySelector('img');
  const active = img.src.includes('star-gold');
  img.src = active ? 'assets/icons/mobile/star.svg' : 'assets/icons/mobile/star-gold.svg';
  showToast(active ? 'Removed from wishlist' : 'Added to wishlist', 'info');
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  let toast = document.getElementById('sw-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sw-toast';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateY(20px);
      padding:10px 20px; border-radius:6px; color:#fff; font-size:14px; font-family:'Roboto',sans-serif;
      z-index:9999; opacity:0; transition:all 0.3s ease; pointer-events:none; white-space:nowrap;
      box-shadow:0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = type === 'success' ? '#2E7D32' : type === 'error' ? '#BE2229' : '#1B99B5';
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

// ─── Header Personalisation ───────────────────────────────────────────────────
function updateHeaderUser(user) {
  if (!user) {
    // Reset to guest state if needed
    document.querySelectorAll('.header-account-text').forEach(el => el.textContent = 'Your Account');
    document.querySelectorAll('.user-first-name').forEach(el => el.textContent = '');
    return;
  }

  const firstName = user.firstName || 'Account';

  // Desktop & Global: "Your Account" → "Hi, {firstName}"
  document.querySelectorAll('.header-account-text, .nav-username').forEach(el => {
    el.textContent = `Hi, ${firstName}`;
  });

  // Any element with class user-first-name
  document.querySelectorAll('.user-first-name').forEach(el => {
    el.textContent = firstName;
  });

  // Handle Profile Image in Header
  if (user.profileImage) {
    const fullImgUrl = user.profileImage.startsWith('http') ? user.profileImage : IMAGE_BASE + user.profileImage;
    document.querySelectorAll('.header-user-icon, .user-profile-img').forEach(el => {
      el.src = fullImgUrl;
      el.classList.add('object-cover', 'rounded-full');
    });
  }

  // Profile page specific displays
  const profileName = document.getElementById('profile-display-name');
  if (profileName) profileName.textContent = `${user.firstName} ${user.lastName || ''}`.trim();

  const profileEmail = document.getElementById('profile-display-email');
  if (profileEmail) profileEmail.textContent = user.email || user.phoneNumber || '';
}

// ─── Location (Centralized) ───────────────────────────────────────────────────
function initLocation() {
  const stored = localStorage.getItem('userLocation');
  if (stored) {
    try {
      const location = JSON.parse(stored);
      updateNavbarLocation(location);
    } catch (e) {
      // Fallback for old string format
      document.querySelectorAll('.location-display, #location-text, .desktop-location-text').forEach(el => el.textContent = stored);
    }
  }
}

function updateNavbarLocation(location) {
  if (!location) return;
  const text = `${location.state}, ${location.country}`;
  document.querySelectorAll('.location-display, #location-text, .desktop-location-text, .nav-location').forEach(el => {
    el.textContent = text;
  });
}

/**
 * Triggered ONLY on Profile Page
 */
/**
 * Triggered ONLY on Profile Page
 */
async function requestLocationPermission() {
  if (!navigator.geolocation) {
    console.warn("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError
  );
}

async function handleLocationSuccess(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );

    const data = await res.json();
    console.log("Geo Data:", data);

    const location = {
      country: data.countryName || "",
      state: data.principalSubdivision || ""
    };

    // Update navbar and storage
    localStorage.setItem('userLocation', JSON.stringify(location));
    updateNavbarLocation(location);

    // If we are on profile page, also fill the fields
    if (typeof fillProfileLocationFields === 'function') {
      fillProfileLocationFields(location);
    }
  } catch (err) {
    console.error("Location fetch failed:", err);
  }
}

function handleLocationError(error) {
  console.warn("Location permission denied or failed:", error.message);
}

// ─── Mobile Menu ──────────────────────────────────────────────────────────────
function initMobileMenu() {
  const btn = document.getElementById('menu-btn');
  const close = document.getElementById('close-menu');
  const menu = document.getElementById('mobile-menu');
  if (!menu) return;

  let overlay = document.getElementById('menu-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'menu-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:49;display:none;';
    document.body.appendChild(overlay);
  }

  const open = () => {
    menu.classList.remove('hidden-menu');
    menu.classList.add('show-menu');
    overlay.style.display = 'block';
    document.body.classList.add('overflow-hidden');
  };

  const closeM = () => {
    menu.classList.add('hidden-menu');
    menu.classList.remove('show-menu');
    overlay.style.display = 'none';
    document.body.classList.remove('overflow-hidden');
  };

  // Use reliable click listeners
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });
  close?.addEventListener('click', closeM);
  overlay.addEventListener('click', closeM);

  // Close menu when any link inside is clicked (Event Delegation)
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      closeM();
    }
  });
}

// ─── Mobile Sticky Header ─────────────────────────────────────────────────────
function initStickyHeader() {
  const subHeader = document.getElementById('mobile-sub-header');
  if (!subHeader) return;

  let lastScrollTop = 0;
  let scrollDelta = 0;
  let isAnimating = false;

  window.addEventListener('scroll', () => {
    if (isAnimating) return;

    let st = window.pageYOffset || document.documentElement.scrollTop;
    if (st < 0) return;

    let diff = st - lastScrollTop;
    if ((diff > 0 && scrollDelta < 0) || (diff < 0 && scrollDelta > 0)) scrollDelta = 0;
    scrollDelta += diff;

    if (scrollDelta > 15 && st > 50 && !subHeader.classList.contains('hide-sub')) {
      subHeader.classList.add('hide-sub');
      isAnimating = true;
      setTimeout(() => { isAnimating = false; scrollDelta = 0; }, 350);
    } else if (scrollDelta < -15 && subHeader.classList.contains('hide-sub')) {
      subHeader.classList.remove('hide-sub');
      isAnimating = true;
      setTimeout(() => { isAnimating = false; scrollDelta = 0; }, 350);
    }
    lastScrollTop = st;
  }, { passive: true });
}

// ─── Mobile Filter Drawer ─────────────────────────────────────────────────────
function initFilterDrawer() {
  const filterBtns = document.querySelectorAll('.filter-btn-mobile, button:has(svg path[d="M4 6H20M6 12H18M8 18H16"])');
  const drawer = document.getElementById('filter-drawer');
  const overlay = document.getElementById('filter-overlay');
  const closeBtn = document.getElementById('close-filter');
  const applyBtn = document.getElementById('apply-filter');

  if (!drawer || !overlay) return;

  const open = () => {
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0');
      drawer.classList.remove('translate-x-full');
    }, 10);
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    overlay.classList.add('opacity-0');
    drawer.classList.add('translate-x-full');
    setTimeout(() => { overlay.classList.add('hidden'); }, 300);
    document.body.style.overflow = '';
  };

  filterBtns.forEach(btn => btn.addEventListener('click', open));
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  applyBtn?.addEventListener('click', close);
}

// ─── Search Functionality ─────────────────────────────────────────────────────
function initSearch() {
  document.querySelectorAll('input[placeholder*="Search"]').forEach(input => {
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return;
      timer = setTimeout(async () => {
        try {
          const data = await apiCall(`/user/search?q=${encodeURIComponent(q)}`);
          // Simple redirect to allproducts with search param
          // A full autocomplete dropdown could be added here
        } catch { }
      }, 400);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim()) {
        window.location.href = `allproducts.html?search=${encodeURIComponent(input.value.trim())}`;
      }
    });
  });
}

// ─── Page: index.html ─────────────────────────────────────────────────────────
async function initHomePage() {
  // Top Sold (Order-based ranking)
  await loadTopSoldProducts();

  // Featured Offers (Admin-controlled)
  await loadFeaturedProducts();

  // Top Categories (Grouped by category, ranked by sales)
  await loadTopCategories();

  // Latest Products
  await loadProductSection('latest-products-grid', 'latest-products-pagination', '/user/products/latest?limit=12', 6);

  // Banners (Position-based system)
  await loadBanners();

  // Categories section
  loadCategoriesSection();
}

/**
 * POSITION-BASED BANNER SYSTEM (Direct Slot Assignment)
 * Ensures banners render ONLY in their correct section and position.
 * No looping/appending; strictly replaces src of existing fixed slots.
 */
async function loadBanners() {
  const prefix = CONFIG.IMAGE_BASE_URL;
  const getUrl = (path) => (path && path.startsWith('/uploads')) ? prefix + path : path;
  const isMobile = window.innerWidth < 768;

  try {
    const data = await apiCall('/banners/public');
    const banners = data.banners || [];
    const active = banners.filter(b => b.isActive === true);

    // 1. FILTER BY TYPE (Strict Isolation)
    const homepage = active.filter(b => b.type === 'homepage');
    const promotional = active.filter(b => b.type === 'promotional');

    // ─── HOMEPAGE HERO SECTION ──────────────────────────────────────────

    const h0 = homepage.find(b => b.position === 0);
    const h1 = homepage.find(b => b.position === 1);
    const h2 = homepage.find(b => b.position === 2);

    if (isMobile) {
      // Mobile Hero Slot
      const mobileImg = document.querySelector('#hero-slider-mobile img');
      if (mobileImg && h0 && h0.mobileImage) {
        mobileImg.src = getUrl(h0.mobileImage);
        const link = mobileImg.closest('a');
        if (link) link.href = h0.link || '#';
      }
    } else {
      // Desktop Main Hero (Position 0)
      const mainImg = document.querySelector('#hero-slider-desktop img');
      if (mainImg && h0 && h0.image) {
        mainImg.src = getUrl(h0.image);
        const link = mainImg.closest('a');
        if (link) link.href = h0.link || '#';
      }

      // Desktop Right Column (Position 1 & 2)
      const rightCol = document.querySelectorAll('#hero-right-col img');
      if (rightCol[0] && h1 && h1.image) {
        rightCol[0].src = getUrl(h1.image);
        const link = rightCol[0].closest('a');
        if (link) link.href = h1.link || '#';
      }
      if (rightCol[1] && h2 && h2.image) {
        rightCol[1].src = getUrl(h2.image);
        const link = rightCol[1].closest('a');
        if (link) link.href = h2.link || '#';
      }
    }

    // ─── PROMOTIONAL SECTION ─────────────────────────────────────────────

    const p0 = promotional.find(b => b.position === 0);
    const p1 = promotional.find(b => b.position === 1);
    const promoImgs = document.querySelectorAll('#promo-banners-container img');

    if (promoImgs.length > 0) {
      // Position 0
      if (p0 && promoImgs[0]) {
        const pImg = isMobile ? (p0.mobileImage || p0.image) : p0.image;
        if (pImg) {
          promoImgs[0].src = getUrl(pImg);
          const link = promoImgs[0].closest('a');
          if (link) link.href = p0.link || '#';
        }
      }
      // Position 1
      if (p1 && promoImgs[1]) {
        const pImg = isMobile ? (p1.mobileImage || p1.image) : p1.image;
        if (pImg) {
          promoImgs[1].src = getUrl(pImg);
          const link = promoImgs[1].closest('a');
          if (link) link.href = p1.link || '#';
        }
      }
    }

    // Secondary Promotional Banner (e.g., allproducts.html)
    const subPromo = document.getElementById('promo-banner');
    if (subPromo && p0) {
      const pImg = isMobile ? (p0.mobileImage || p0.image) : p0.image;
      if (pImg) {
        subPromo.src = getUrl(pImg);
        const link = subPromo.closest('a');
        if (link) link.href = p0.link || '#';
      }
    }

  } catch (err) {
    console.warn("Dynamic banners could not load; using fallback defaults.", err);
  }
}

/**
 * FEATURED PRODUCTS LOGIC
 * Fetches products and filters by admin 'isFeatured' flag.
 */
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-offers-grid');
  if (!grid) return;

  try {
    // Fetch a sample of products for filtering
    const data = await apiCall('/user/products?limit=50');
    const products = data.products || [];

    // Business Logic: Admin decides if isFeatured is true
    const featured = products.filter(p => p.isFeatured === true);

    if (!featured.length) {
      // Hide section if nothing is featured
      const section = grid.closest('section');
      if (section) section.style.display = 'none';
      return;
    }

    // Render featured items (Top 6)
    grid.innerHTML = featured.slice(0, 6).map(p => buildProductCard(p)).join('');
  } catch (err) {
    console.error("Featured Products Load Error:", err);
  }
}

/**
 * TOP SOLD PRODUCTS LOGIC
 * Sorts products based on sales volume (totalSold field provided by backend).
 */
async function loadTopSoldProducts() {
  const grid = document.getElementById('top-sold-grid');
  const paginationId = 'top-sold-pagination';
  if (!grid) return;

  try {
    // Fetch a significant sample to rank from
    const data = await apiCall('/user/products?limit=200');
    let products = data.products || [];

    // Filter & Sort: Include ONLY products that have actually been sold
    products = products.filter(p => (p.totalSold || 0) > 0)
      .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));

    // Fallback: If no products have sales yet, show latest products instead
    if (!products.length) {
      await loadProductSection(grid.id, paginationId, '/user/products/latest?limit=24', 6);
      return;
    }

    // Use standard 6-per-page pagination logic to match other sections
    const perPage = 6;
    let page = 0;
    const total = products.length;

    function render() {
      const start = page * perPage;
      const slice = products.slice(start, start + perPage);
      grid.innerHTML = slice.map(p => buildProductCard(p)).join('');

      const pag = document.getElementById(paginationId);
      if (pag) {
        const info = pag.querySelector('.page-info');
        if (info) info.textContent = `${start + 1}-${Math.min(start + perPage, total)} of ${total}`;
        updatePaginationUI(paginationId, page, total, perPage);
      }
    }

    render();

    // Wire standard pagination buttons
    const pag = document.getElementById(paginationId);
    if (pag) {
      pag.querySelector('.prev-btn')?.addEventListener('click', () => {
        if (page > 0) { page--; render(); }
      });
      pag.querySelector('.next-btn')?.addEventListener('click', () => {
        if ((page + 1) * perPage < total) { page++; render(); }
      });
    }

  } catch (err) {
    console.warn("Top Sold Products Load Error:", err);
  }
}

/**
 * TOP CATEGORIES LOGIC
 * Showcases category diversity by displaying exactly 1 top-selling product 
 * from each major category in a unified grid.
 */
async function loadTopCategories() {
  const grid = document.getElementById('top-categories-grid');
  if (!grid) return;

  try {
    const data = await apiCall('/user/products?limit=200');
    const products = data.products || [];

    // 1. Grouping: categoryName -> [products]
    const categoryMap = {};
    products.forEach(p => {
      const catName = p.category?.name;
      if (!catName) return; // Skip if no category
      if (!categoryMap[catName]) categoryMap[catName] = [];
      categoryMap[catName].push(p);
    });

    // 2. Selection: Best product per category
    const categoryRepresentatives = Object.entries(categoryMap).map(([name, prods]) => {
      // Sort items inside this category by sales
      const sortedProds = prods.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
      // Sum of sales for the whole category (for ranking)
      const totalSales = prods.reduce((sum, item) => sum + (item.totalSold || 0), 0);

      return {
        bestProduct: sortedProds[0],
        totalSales
      };
    });

    // 3. Ranking for Limit: Sort categories by their total popularity
    categoryRepresentatives.sort((a, b) => b.totalSales - a.totalSales);

    // Pick top 12 representative products
    const finalSelection = categoryRepresentatives
      .slice(0, 12)
      .map(rep => rep.bestProduct);

    // Fallback: If no products found
    if (!finalSelection.length) {
      await loadProductSection('top-categories-grid', 'top-categories-pagination', '/user/products/latest?limit=12', 6);
      return;
    }

    // 4. Render in a clean grid
    grid.innerHTML = finalSelection.map(p => buildProductCard(p)).join('');

  } catch (err) {
    console.error("Top Categories Selection Error:", err);
  }
}

async function loadProductSection(gridId, paginationId, endpoint, perPage = 6) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  try {
    const data = await apiCall(endpoint);
    const products = data.products || [];
    if (!products.length) return;

    let page = 0;
    const total = products.length;

    function render() {
      const start = page * perPage;
      const slice = products.slice(start, start + perPage);
      grid.innerHTML = slice.map(p => buildProductCard(p)).join('');

      // Update pagination info
      const pag = document.getElementById(paginationId);
      if (pag) {
        const info = pag.querySelector('.page-info');
        if (info) info.textContent = `${start + 1}-${Math.min(start + perPage, total)} of ${total}`;
        updatePaginationUI(paginationId, page, total, perPage);
      }
    }

    render();

    // Wire pagination buttons
    const pag = document.getElementById(paginationId);
    if (pag) {
      pag.querySelector('.prev-btn')?.addEventListener('click', () => {
        if (page > 0) { page--; render(); }
      });
      pag.querySelector('.next-btn')?.addEventListener('click', () => {
        if ((page + 1) * perPage < total) { page++; render(); }
      });
    }
  } catch (e) {
    console.warn('Product section load failed:', gridId, e.message);
  }
}

async function loadCategoriesSection() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  try {
    const data = await apiCall('/user/categories');
    const cats = (data.categories || []).filter(c => c.isActive !== false);
    if (!cats.length) return;

    const perPage = 8;
    let page = 0;

    function render() {
      const start = page * perPage;
      const slice = cats.slice(start, start + perPage);
      grid.innerHTML = slice.map(c => {
        const img = c.banner ? (c.banner.startsWith('http') ? c.banner : `${API_BASE.replace('/api', '')}/uploads/${c.banner}`) : 'assets/images/deafult.png';
        return `<div class="ec-card" style="cursor:pointer" onclick="window.location.href='allproducts.html?category=${c._id}'">
          <div class="ec-img-box"><img src="${img}" alt="${c.name}" onerror="this.src='assets/images/deafult.png'"></div>
          <p class="ec-name">${c.name}</p>
        </div>`;
      }).join('');
      const info = document.querySelector('#categories-pagination .ec-page-info');
      if (info) info.textContent = `${start + 1}–${Math.min(start + perPage, cats.length)} of ${cats.length}`;
      updatePaginationUI('categories-pagination', page, cats.length, perPage);
    }

    render();

    // Poster: first category banner
    const poster = document.getElementById('categories-poster');
    if (poster && cats[0]?.banner) {
      const src = cats[0].banner.startsWith('http') ? cats[0].banner : `${API_BASE.replace('/api', '')}/uploads/${cats[0].banner}`;
      poster.innerHTML = `<img src="${src}" alt="Categories" onerror="this.src='assets/images/deafult.png'">`;
    }

    const pag = document.getElementById('categories-pagination');
    if (pag) {
      const btns = pag.querySelectorAll('.ec-page-btn');
      btns[0]?.addEventListener('click', () => { if (page > 0) { page--; render(); } });
      btns[1]?.addEventListener('click', () => { if ((page + 1) * perPage < cats.length) { page++; render(); } });
    }
  } catch { }
}

// ─── Page: allproducts.html ───────────────────────────────────────────────────
async function initAllProductsPage() {
  const params = new URLSearchParams(window.location.search);

  // 1. STATE MANAGEMENT
  const state = {
    products: [],
    filteredProducts: [],
    allCategories: [],
    currentPage: 1,
    itemsPerPage: 20,
    filters: {
      search: params.get('search') || '',
      category: params.get('category') || '',
      subcategory: params.get('subcategory') || '',
      priceMin: 0,
      priceMax: 100000,
      inStockOnly: false
    }
  };

  // 2. UI ELEMENTS
  const grid = document.getElementById('product-grid');
  const catCarousel = document.getElementById('cat-carousel');
  const catSidebar = document.getElementById('category-filters-container');
  const bcContainer = document.getElementById('breadcrumb');
  const pageInfoTop = document.getElementById('pagination-info');
  const pageInfoBottom = document.getElementById('pagination-info-bottom');

  const thumbMin = document.getElementById('thumb-min');
  const thumbMax = document.getElementById('thumb-max');
  const sliderArea = document.getElementById('slider-area');
  const activeTrack = document.getElementById('slider-active-track');
  const inputMin = document.getElementById('input-min');
  const inputMax = document.getElementById('input-max');
  const labelMin = document.getElementById('label-min');
  const labelMax = document.getElementById('label-max');

  const SLIDER_LIMIT = 100000;

  // 3. CORE LOGIC
  async function init() {
    try {
      console.log("[AllProducts] Initializing...");
      if (grid) grid.innerHTML = '<div class="col-span-2 lg:col-span-5 flex items-center justify-center py-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-[#BE2229]"></div></div>';

      const [catData, prodData] = await Promise.all([
        apiCall('/user/categories').catch(() => ({ categories: [] })),
        apiCall('/user/products?limit=1000').catch(() => ({ products: [] }))
      ]);

      state.allCategories = catData.categories || [];
      state.products = prodData.products || [];

      console.log(`[AllProducts] Loaded ${state.products.length} products`);

      renderCategories();
      applyFilters();
      setupEventListeners();
      loadPromotionalBanner();
    } catch (err) {
      console.error("[AllProducts] Init Error:", err);
      if (grid) grid.innerHTML = '<div class="col-span-2 lg:col-span-5 text-center py-12 text-red-500">Failed to load products. Please refresh.</div>';
    }
  }

  async function loadPromotionalBanner() {
    const bannerImg = document.getElementById('promo-banner');
    const bannerLink = document.getElementById('promo-banner-link');
    if (!bannerImg) return;

    try {
      const data = await apiCall('/banners/public');
      const promoBanners = (data.banners || []).filter(b => b.type === 'promotional' && b.isActive);
      if (promoBanners.length > 0) {
        const banner = promoBanners[0];
        const fullPath = banner.image.startsWith('http') ? banner.image : `${IMAGE_BASE}${banner.image}`;
        if (bannerLink && banner.link) {
          bannerLink.href = banner.link;
        }
        bannerImg.src = fullPath;
        bannerImg.style.opacity = '1';
      }
    } catch (err) {
      console.warn("[AllProducts] Banner Error:", err);
    }
  }

  function applyFilters() {
    try {
      state.filteredProducts = state.products.filter(p => {
        const pricing = Pricing.calculate(p);
        const price = Number(pricing.finalPrice || 0);
        const priceMatch = price >= state.filters.priceMin && price <= state.filters.priceMax;

        const catId = p.category?._id || p.category;
        const categoryMatch = !state.filters.category || catId === state.filters.category;

        const subId = p.subcategory?._id || p.subcategory;
        const subcategoryMatch = !state.filters.subcategory || subId === state.filters.subcategory;

        const term = state.filters.search.toLowerCase();
        const searchMatch = !term || (p.name || '').toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term);

        const availabilityMatch = !state.filters.inStockOnly || Number(p.stock || 0) > 0;

        return priceMatch && categoryMatch && subcategoryMatch && searchMatch && availabilityMatch;
      });

      state.currentPage = 1;
      renderProducts();
      updateBreadcrumb();
    } catch (err) {
      console.error("[AllProducts] Filter Error:", err);
    }
  }

  function renderProducts() {
    if (!grid) return;
    if (state.filteredProducts.length === 0) {
      grid.innerHTML = '<div class="col-span-2 lg:col-span-5 text-center py-12 text-gray-500">No products found matching filters.</div>';
      updatePaginationUI();
      return;
    }

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const paginated = state.filteredProducts.slice(start, start + state.itemsPerPage);
    grid.innerHTML = paginated.map(p => buildProductCard(p, 'product-card')).join('');
    updatePaginationUI();
  }

  function updatePaginationUI() {
    const total = state.filteredProducts.length;
    const totalPages = Math.ceil(total / state.itemsPerPage);
    const start = total === 0 ? 0 : (state.currentPage - 1) * state.itemsPerPage + 1;
    const end = Math.min(state.currentPage * state.itemsPerPage, total);
    const text = `${start}–${end} of ${total}`;

    if (pageInfoTop) pageInfoTop.textContent = text;
    if (pageInfoBottom) pageInfoBottom.textContent = text;

    // Enable/Disable buttons
    document.querySelectorAll('.prev-btn').forEach(btn => {
      btn.disabled = state.currentPage === 1;
      btn.style.opacity = state.currentPage === 1 ? '0.5' : '1';
    });
    document.querySelectorAll('.next-btn').forEach(btn => {
      btn.disabled = state.currentPage >= totalPages;
      btn.style.opacity = state.currentPage >= totalPages ? '0.5' : '1';
    });
  }

  function renderCategories() {
    if (catSidebar) {
      catSidebar.innerHTML = `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" value="all" class="filter-category-cb w-4 h-4 accent-[#BE2229] rounded" ${!state.filters.category ? 'checked' : ''}><span class="text-[13px] font-medium">All</span></label>`;
      state.allCategories.forEach(c => {
        const div = document.createElement('div');
        div.className = 'mt-2';
        div.innerHTML = `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" value="${c._id}" class="filter-category-cb w-4 h-4 accent-[#BE2229] rounded" ${state.filters.category === c._id ? 'checked' : ''}><span class="text-[13px] font-medium">${c.name}</span></label>`;
        catSidebar.appendChild(div);
      });
    }

    if (catCarousel) {
      const allChip = `
        <div class="cat-chip snap-start flex-shrink-0 w-[90px] h-[80px] lg:w-[230px] lg:h-[145px] bg-white rounded-[6px] lg:rounded-[8px] flex flex-col cursor-pointer border ${!state.filters.category ? 'border-[#BE2229] shadow-md' : 'border-[rgba(234,234,234,0.63)]'}" data-cat-id="">
          <div class="flex-1 flex items-center justify-center p-2 min-h-0"><img src="assets/images/deafult.png" class="max-h-full object-contain"></div>
          <div class="pb-2 text-center"><span class="text-[9px] lg:text-[18px] font-medium">All Categories</span></div>
        </div>`;

      catCarousel.innerHTML = allChip + state.allCategories.map(c => {
        const img = c.banner ? (c.banner.startsWith('http') ? c.banner : `${IMAGE_BASE}/uploads/${c.banner}`) : 'assets/images/deafult.png';
        const isSel = state.filters.category === c._id;
        return `
          <div class="cat-chip snap-start flex-shrink-0 w-[90px] h-[80px] lg:w-[230px] lg:h-[145px] bg-white rounded-[6px] lg:rounded-[8px] flex flex-col cursor-pointer border ${isSel ? 'border-[#BE2229] shadow-md' : 'border-[rgba(234,234,234,0.63)]'}" data-cat-id="${c._id}">
            <div class="flex-1 flex items-center justify-center p-2 min-h-0"><img src="${img}" class="max-h-full object-contain" onerror="this.src='assets/images/deafult.png'"></div>
            <div class="pb-2 text-center"><span class="text-[9px] lg:text-[18px] font-medium">${c.name}</span></div>
          </div>`;
      }).join('');

      catCarousel.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          state.filters.category = chip.dataset.catId;
          renderCategories();
          applyFilters();
        });
      });
    }
  }

  function updateBreadcrumb() {
    if (!bcContainer) return;
    let html = `<a href="index.html">Home</a> &gt; <a href="allproducts.html">All Products</a>`;
    if (state.filters.category) {
      const cat = state.allCategories.find(c => c._id === state.filters.category);
      if (cat) html += ` &gt; <span class="font-medium">${cat.name}</span>`;
    }
    bcContainer.innerHTML = html;
  }

  function setupEventListeners() {
    document.addEventListener('change', e => {
      if (e.target.classList.contains('filter-category-cb')) {
        state.filters.category = (e.target.value === 'all') ? '' : e.target.value;
        renderCategories();
        applyFilters();
      }
      if (e.target.classList.contains('filter-availability')) {
        state.filters.inStockOnly = e.target.checked;
        applyFilters();
      }
    });

    inputMin?.addEventListener('change', (e) => { state.filters.priceMin = Number(e.target.value); updatePriceUI(); applyFilters(); });
    inputMax?.addEventListener('change', (e) => { state.filters.priceMax = Number(e.target.value); updatePriceUI(); applyFilters(); });

    let isDraggingMin = false, isDraggingMax = false;
    const handleMove = (e) => {
      if (!isDraggingMin && !isDraggingMax) return;
      const rect = sliderArea.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const val = Math.round(Math.min(Math.max(0, (x / rect.width)), 1) * SLIDER_LIMIT);
      if (isDraggingMin) state.filters.priceMin = Math.min(val, state.filters.priceMax - 100);
      else state.filters.priceMax = Math.max(val, state.filters.priceMin + 100);
      updatePriceUI();
      applyFilters();
    };

    thumbMin?.addEventListener('mousedown', () => isDraggingMin = true);
    thumbMax?.addEventListener('mousedown', () => isDraggingMax = true);
    thumbMin?.addEventListener('touchstart', (e) => { isDraggingMin = true; e.preventDefault(); }, { passive: false });
    thumbMax?.addEventListener('touchstart', (e) => { isDraggingMax = true; e.preventDefault(); }, { passive: false });

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', (e) => { if (isDraggingMin || isDraggingMax) { handleMove(e); e.preventDefault(); } }, { passive: false });

    window.addEventListener('mouseup', () => { isDraggingMin = false; isDraggingMax = false; });
    window.addEventListener('touchend', () => { isDraggingMin = false; isDraggingMax = false; });

    window.performReset = () => {
      state.filters = { search: '', category: '', subcategory: '', priceMin: 0, priceMax: SLIDER_LIMIT, inStockOnly: false };
      updatePriceUI();
      renderCategories();
      applyFilters();
    };

    // Mobile Filter Panel Toggle
    const mobileFilterBtn = document.getElementById('mobile-filter-btn');
    const closeFilterBtn = document.getElementById('close-filter-btn');
    const filterSidebar = document.getElementById('filter-sidebar');
    const filterOverlay = document.getElementById('filter-overlay');

    const toggleFilter = (show) => {
      if (!filterSidebar) return;
      if (show) {
        filterSidebar.classList.remove('hidden', '-translate-x-full');
        filterSidebar.classList.add('flex', 'translate-x-0');
        filterOverlay?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      } else {
        filterSidebar.classList.add('-translate-x-full');
        filterSidebar.classList.remove('translate-x-0');
        filterOverlay?.classList.add('hidden');
        document.body.style.overflow = '';
        setTimeout(() => filterSidebar.classList.add('hidden'), 300);
      }
    };

    mobileFilterBtn?.addEventListener('click', () => toggleFilter(true));
    closeFilterBtn?.addEventListener('click', () => toggleFilter(false));
    filterOverlay?.addEventListener('click', () => toggleFilter(false));

    // Pagination Listeners
    document.querySelectorAll('.prev-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderProducts();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.next-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredProducts.length / state.itemsPerPage);
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderProducts();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  function updatePriceUI() {
    const minP = (state.filters.priceMin / SLIDER_LIMIT) * 100;
    const maxP = (state.filters.priceMax / SLIDER_LIMIT) * 100;
    if (thumbMin) thumbMin.style.left = `${minP}%`;
    if (thumbMax) thumbMax.style.left = `${maxP}%`;
    if (activeTrack) { activeTrack.style.left = `${minP}%`; activeTrack.style.width = `${maxP - minP}%`; }
    if (labelMin) labelMin.textContent = Math.round(state.filters.priceMin);
    if (labelMax) labelMax.textContent = Math.round(state.filters.priceMax);
    if (inputMin) inputMin.value = Math.round(state.filters.priceMin);
    if (inputMax) inputMax.value = Math.round(state.filters.priceMax);
  }

  updatePriceUI();
  init();
}

function toggleWishlist(productId, btn) {
  Wishlist.toggle(productId, btn);
}

/**
 * WISHLIST PAGE INITIALIZATION
 */
async function initWishlistPage() {
  const grid = document.getElementById('wishlist-grid');
  const empty = document.getElementById('wishlist-empty');
  if (!grid) return;

    async function render() {
      if (grid) grid.classList.remove('hidden');
      if (empty) empty.classList.add('hidden');

      try {
        let products = [];
        if (Auth.isLoggedIn()) {
          const data = await apiCall('/user/wishlist', 'GET', null, true);
          console.log("Wishlist page load response:", data);
          products = data.products || [];
          console.log("Rendering products:", products);
          // Sync items array from full objects
          Wishlist.items = products.map(p => String(p._id));
        } else {
          const data = await apiCall('/user/products?limit=1000');
          const all = data.products || [];
          products = all.filter(p => Wishlist.items.includes(String(p._id)));
        }

        if (products.length === 0) {
          if (grid) grid.classList.add('hidden');
          if (empty) empty.classList.remove('hidden');
          Wishlist.updateBadge();
          return;
        }
      grid.innerHTML = products.map(p => buildProductCard(p, 'product-card', true)).join('');
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-500">Failed to load wishlist.</div>`;
    }
  }

  const originalToggle = Wishlist.toggle;
  Wishlist.toggle = async function (id, btn) {
    const p = originalToggle.call(Wishlist, id, btn);
    if (document.body.dataset.page === 'wishlist') render();
    await p;
  };
  render();
}
async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  if (!productId) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const data = await apiCall(`/user/products/${productId}`);
    const p = data.product;
    if (!p) {
      showToast('Product not found', 'error');
      return;
    }

    const setVal = (id, val, isImg = false) => {
      const el = document.getElementById(id);
      if (el) {
        if (isImg) el.src = val;
        else el.innerHTML = val;
      }
    };

    // --- Dynamic Breadcrumb Logic ---
    const renderBreadcrumb = (product) => {
      const bc = document.getElementById('breadcrumb');
      if (!bc) return;

      let html = `<a href="allproducts.html" class="hover:text-[#BE2229]">All Categories</a>`;

      if (product.category) {
        html += ` &gt; <a href="allproducts.html?category=${product.category._id}" class="hover:text-[#BE2229]">${product.category.name}</a>`;
      }

      if (product.subcategory) {
        html += ` &gt; <a href="allproducts.html?subcategory=${product.subcategory._id}" class="hover:text-[#BE2229]">${product.subcategory.name}</a>`;
      }

      html += ` &gt; <span class="text-black font-medium">${product.name}</span>`;
      bc.innerHTML = html;
    };
    renderBreadcrumb(p);

    const mainImg = productImg(p);
    setVal('product-title-desktop', p.name);
    setVal('product-brand-desktop', p.brand || 'Springwala');
    setVal('product-short-desc-desktop', p.shortDescription || p.description?.substring(0, 200) + '...');
    setVal('product-reviews-desktop', `(${p.totalReviews || 0})`);
    setVal('product-main-image-desktop', mainImg, true);

    setVal('product-title-mobile', p.name);
    setVal('product-brand-mobile', p.brand || 'Springwala');
    setVal('product-short-desc-mobile', p.shortDescription || p.description?.substring(0, 200) + '...');
    setVal('mobileMainImage', mainImg, true);

    const descContent = `
      <p class="mb-4">Product Description</p>
      <div class="font-normal text-[#5C5C5C]">${p.description || 'No description available.'}</div>
    `;
    const descDesktop = document.getElementById('product-description-desktop');
    if (descDesktop) descDesktop.innerHTML = descContent;
    const descMobile = document.getElementById('product-description-mobile');
    if (descMobile) descMobile.innerHTML = descContent;

    const specsHTML = (p.specifications || []).map(s => `${s.key}: ${s.value}`).join('<br>');
    const specsDesktop = document.getElementById('product-specs-desktop');
    if (specsDesktop) specsDesktop.innerHTML = specsHTML || 'Standard specifications apply.';
    const specsMobile = document.getElementById('product-specs-mobile');
    if (specsMobile) specsMobile.innerHTML = specsHTML || 'Standard specifications apply.';

    let hsnValue = p.hsnCode || '';
    if (!hsnValue && p.specifications) {
      const hsnSpec = p.specifications.find(s => s.key && s.key.toUpperCase().includes('HSN'));
      if (hsnSpec) hsnValue = hsnSpec.value;
    }
    setVal('summary-hsn', hsnValue || 'N/A');
    setVal('summary-hsn-mobile', hsnValue || 'N/A');

    const thumbContainer = document.getElementById('product-thumbnails-desktop');
    const mobileThumbDots = document.getElementById('mobileCarouselDots');

    if (thumbContainer && p.images?.length) {
      thumbContainer.innerHTML = p.images.slice(0, 4).map(img => {
        const s = productImg({ images: [img] });
        return `
          <div class="w-[96px] h-[88px] bg-[#D9D9D9] rounded-[7px] cursor-pointer hover:opacity-80 transition overflow-hidden p-1 border-2 border-transparent hover:border-[#BE2229]">
            <img src="${s}" alt="Thumb" class="w-full h-full object-contain mix-blend-multiply" onclick="document.getElementById('product-main-image-desktop').src='${s}'; document.getElementById('mobileMainImage').src='${s}'">
          </div>`;
      }).join('');
    }

    if (mobileThumbDots && p.images?.length) {
      mobileThumbDots.innerHTML = p.images.slice(0, 4).map((img, i) => {
        const s = productImg({ images: [img] });
        return `<div class="w-6 h-1 ${i === 0 ? 'bg-[#625656]' : 'bg-[#D9D9D9]'} rounded-full transition-colors duration-300 cursor-pointer" onclick="document.getElementById('mobileMainImage').src='${s}'"></div>`;
      }).join('');
    }

    const variantDesktop = document.getElementById('product-variants-desktop');
    const variantMobile = document.getElementById('product-variants-mobile');
    let selectedBatch = null;
    const hasBatches = p.batches && p.batches.length > 0;
    let qty = 1;

    const updateSummary = () => {
      const data = Pricing.calculate(p, qty, selectedBatch);
      const suffixes = ['', '-mobile'];

      suffixes.forEach(s => {
        setVal(`qty-value${s}`, data.quantity);
        setVal(`summary-batch${s}`, data.batch);
        setVal(`summary-hsn${s}`, data.hsn);
        setVal(`summary-unit-price${s}`, `₹${data.perUnitPrice.toFixed(2)}`);
        setVal(`summary-price${s}`, `₹${data.finalPrice.toFixed(2)}`);
        setVal(`summary-discount${s}`, `${data.discount}%`);
        setVal(`summary-delivery${s}`, 'Free');
        setVal(`summary-subtotal${s}`, `₹${data.subtotal.toFixed(2)}`);

        // Update Labels for Clarity
        const priceRow = document.getElementById(`summary-price${s}`)?.parentElement;
        if (priceRow) priceRow.querySelector('span:first-child').textContent = 'Per Pack (incl. GST)';

        const gstRow = document.getElementById(`summary-gst${s}`)?.parentElement;
        if (gstRow) gstRow.style.display = 'none'; // Hide separate GST row

        const deliveryRow = document.getElementById(`summary-delivery${s}`)?.parentElement;
        if (deliveryRow) deliveryRow.querySelector('span:first-child').textContent = 'Delivery';

        // Toggle Batch Visibility
        const bRow = document.getElementById(`summary-batch${s}`)?.parentElement;
        if (bRow) bRow.style.display = hasBatches ? 'flex' : 'none';

        const uRow = document.getElementById(`summary-total-units${s}`)?.parentElement;
        if (uRow) uRow.style.display = hasBatches ? 'flex' : 'none';
        if (uRow) setVal(`summary-total-units${s}`, qty * (selectedBatch?.quantity || 1));
      });

      // Main Display Updates
      const displayPrice = `₹${data.finalPrice.toFixed(2)}`;
      setVal('product-price-desktop', displayPrice);
      setVal('product-price-mobile', displayPrice);
      ['product-pack-size-desktop', 'product-pack-size-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = hasBatches ? `(${data.batch})` : '';
      });
      const displayPerUnit = `₹${data.perUnitPrice.toFixed(2)}`;
      setVal('product-unit-price-desktop', `${displayPerUnit} per unit`);
      setVal('product-unit-price-mobile', `${displayPerUnit} per unit`);

      const tUnits = document.getElementById('total-units-display');
      if (tUnits) tUnits.textContent = `Total: ${qty * (selectedBatch?.quantity || 1)} units`;

      const tUnitsMob = document.getElementById('total-units-display-mobile-text');
      if (tUnitsMob) tUnitsMob.textContent = `Total: ${qty * (selectedBatch?.quantity || 1)} units`;

      const mobStickyPrice = document.querySelector('.md\\:hidden.fixed.bottom-\\[57px\\] #product-price-mobile');
      if (mobStickyPrice) mobStickyPrice.textContent = `₹${data.subtotal}`;
    };

    if (hasBatches) {
      selectedBatch = p.batches[0];
      const renderBatches = (container, isMobile) => {
        if (!container) return;
        container.innerHTML = p.batches.map((b, i) => {
          const active = b === selectedBatch ? 'bg-[#BE2229] text-white' : 'bg-white border border-[#D9D9D9] text-black';
          const fontSize = isMobile ? 'text-[16px]' : 'text-[12px]';
          const height = isMobile ? '' : 'h-[22px]';
          const padding = isMobile ? 'px-4 py-1' : 'px-3 py-1';
          return `<button class="batch-btn ${active} ${padding} rounded-[6px] ${fontSize} ${height} flex items-center focus:outline-none whitespace-nowrap transition-all" 
                   data-index="${i}">Pack of ${b.quantity}</button>`;
        }).join('');
      };
      renderBatches(variantDesktop, false);
      renderBatches(variantMobile, true);

      const handleBatchClick = (e) => {
        const btn = e.target.closest('.batch-btn');
        if (!btn) return;
        selectedBatch = p.batches[parseInt(btn.dataset.index)];
        renderBatches(variantDesktop, false);
        renderBatches(variantMobile, true);
        updateSummary();
      };
      variantDesktop?.addEventListener('click', handleBatchClick);
      variantMobile?.addEventListener('click', handleBatchClick);
    } else {
      selectedBatch = { quantity: 1, price: p.discountedPrice || p.price };
      const desktopCont = variantDesktop?.closest('.mb-5.relative');
      if (desktopCont) desktopCont.style.display = 'none';
      const mobileCont = variantMobile?.closest('.px-4.mb-6');
      if (mobileCont) mobileCont.style.display = 'none';
      const hideRows = (suffix = '') => {
        ['batch', 'total-units'].forEach(f => {
          const el = document.getElementById(`summary-${f}${suffix}`);
          if (el) el.parentElement.style.display = 'none';
        });
        const pEl = document.getElementById(`summary-price${suffix}`);
        if (pEl) pEl.previousElementSibling.textContent = 'Price';
      };
      hideRows(); hideRows('-mobile');
    }

    const setupQty = (plusId, minusId) => {
      document.getElementById(plusId)?.addEventListener('click', () => { qty++; updateSummary(); });
      document.getElementById(minusId)?.addEventListener('click', () => { if (qty > 1) { qty--; updateSummary(); } });
    };
    setupQty('qty-plus', 'qty-minus');
    setupQty('qty-plus-mobile', 'qty-minus-mobile');
    updateSummary();

    const handleAdd = (redirect = false) => {
      if (!isUserLoggedIn()) {
        localStorage.setItem("redirectAfterLogin", window.location.href);
        showToast("Please login to continue", "warning");
        setTimeout(() => { window.location.href = 'login.html'; }, 1200);
        return;
      }
      const pricing = Pricing.calculate(p, qty, selectedBatch);

      Cart.add(p._id, p.name, mainImg, pricing.finalPrice, qty, selectedBatch.quantity);

      if (redirect) window.location.href = 'cart.html';
      else showToast('Added to cart!', 'success');
    };
    document.getElementById('add-to-cart-btn')?.addEventListener('click', () => handleAdd(false));
    document.getElementById('buy-now-btn')?.addEventListener('click', () => handleAdd(true));
    document.getElementById('buy-now-btn-mobile')?.addEventListener('click', () => handleAdd(true));

    // 6. Wishlist Logic for current product
    document.querySelectorAll('.product-wishlist-btn').forEach(btn => {
      btn.dataset.productId = p._id;
      btn.onclick = (e) => {
        e.preventDefault();
        toggleWishlist(p._id, btn);
      };
      Wishlist.updateIcon(p._id, btn);
    });

    // 7. Related Products (by category)
    if (p.category?._id) {
      const relData = await apiCall(`/user/products?category=${p.category._id}&limit=6`);
      const relGrid = document.getElementById('related-products-grid');
      if (relGrid) relGrid.innerHTML = (relData.products || []).filter(rp => rp._id !== p._id).map(rp => buildProductCard(rp)).join('');
    }

    // 8. Top Sold Products
    const soldData = await apiCall('/user/products?limit=100');
    const soldProducts = (soldData.products || [])
      .filter(sp => (sp.totalSold || 0) > 0)
      .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
      .slice(0, 6);
    const soldGrid = document.getElementById('top-sold-products-grid');
    if (soldGrid) soldGrid.innerHTML = (soldProducts.length ? soldProducts : (soldData.products || []).slice(0, 6)).map(sp => buildProductCard(sp)).join('');

    // 9. Featured Products
    const featData = await apiCall('/user/products/featured?limit=6');
    const featGrid = document.getElementById('featured-products-grid');
    if (featGrid) featGrid.innerHTML = (featData.products || []).map(fp => buildProductCard(fp)).join('');

    // 10. Latest Products
    const latestGrid = document.getElementById('latest-products-grid');
    if (latestGrid) latestGrid.innerHTML = (soldData.products || []).slice(0, 6).map(lp => buildProductCard(lp)).join('');

  } catch (e) {
    console.warn('Product page load failed:', e.message);
  }
}

// ─── Page: cart.html ──────────────────────────────────────────────────────────
async function initCartPage() {
  renderCart();
  loadRecommendedProducts();
}

async function renderCart() {
  if (Auth.isLoggedIn()) {
    await loadCartCount();
  }

  const items = Cart.get();
  const totals = Cart.totals();

  const emptyDesktop = document.getElementById('empty-cart-desktop');
  const emptyMobile = document.getElementById('empty-cart-mobile');
  const itemsDesktop = document.getElementById('cart-items-desktop');
  const itemsMobile = document.getElementById('cart-items-mobile');

  if (items.length === 0) {
    emptyDesktop?.classList.remove('hidden');
    emptyMobile?.classList.remove('hidden');
    itemsDesktop?.classList.add('hidden');
    itemsMobile?.classList.add('hidden');
  } else {
    emptyDesktop?.classList.add('hidden');
    emptyMobile?.classList.add('hidden');
    itemsDesktop?.classList.remove('hidden');
    itemsMobile?.classList.remove('hidden');

    if (!Auth.isLoggedIn()) {
      const noticeHtml = `
        <div class="w-full bg-[#FFF4F4] border border-[#FFDADA] rounded-[8px] p-4 mb-6 flex items-center justify-between">
          <p class="text-[14px] text-[#BE2229] font-medium">Please login to sync your cart and proceed to checkout.</p>
          <a href="login.html" class="text-[14px] text-white bg-[#BE2229] px-4 py-1.5 rounded-[5px] font-medium">Login Now</a>
        </div>
      `;
      if (itemsDesktop) itemsDesktop.insertAdjacentHTML('afterbegin', noticeHtml);
      if (itemsMobile) itemsMobile.insertAdjacentHTML('afterbegin', noticeHtml);
    }

    if (itemsDesktop) {
      itemsDesktop.innerHTML = items.map(item => {
        const name = item.name || 'Product';
        const image = item.image;
        const finalPrice = Number(item.finalPrice || item.price || item.pricePerUnit || 0) || 0;
        const fullImg = getImageUrl(image);

        return `
        <div class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0">
          <div class="flex items-center gap-4">
            <img src="${fullImg}" class="w-[80px] h-[80px] object-contain rounded" alt="${name}" onerror="this.onerror=null; this.src='assets/images/deafult.png';">
            <div>
              <h4 class="font-bold text-[16px] text-black">${name}</h4>
              <div class="flex items-center gap-2 mt-2">
                <button class="w-[24px] h-[24px] border border-gray-300 flex items-center justify-center rounded" onclick="Cart.updateQty('${item.itemId || item.productId}', ${item.quantity - 1})">-</button>
                <span class="text-[14px]">${item.quantity}</span>
                <button class="w-[24px] h-[24px] border border-gray-300 flex items-center justify-center rounded" onclick="Cart.updateQty('${item.itemId || item.productId}', ${item.quantity + 1})">+</button>
                <button class="text-[12px] text-[#BE2229] ml-4 hover:underline" onclick="Cart.remove('${item.itemId || item.productId}')">Remove</button>
              </div>
            </div>
          </div>
          <div class="text-right">
            <p class="text-[18px] font-bold text-black">₹${(finalPrice * item.quantity).toFixed(2)}</p>
          </div>
        </div>
      `;
      }).join('');
    }

    if (itemsMobile) {
      itemsMobile.innerHTML = items.map(item => {
        const name = item.name || 'Product';
        const image = item.image;
        const finalPrice = Number(item.finalPrice || item.price || item.pricePerUnit || 0) || 0;
        const fullImg = getImageUrl(image);

        return `
        <div class="bg-white p-4 rounded-lg border border-gray-100 mb-2">
          <div class="flex gap-4">
            <img src="${fullImg}" class="w-[64px] h-[64px] object-contain rounded" alt="${name}" onerror="this.onerror=null; this.src='assets/images/deafult.png';">
            <div class="flex-1">
              <h4 class="font-bold text-[14px] text-black">${name}</h4>
              <div class="flex items-center justify-between mt-3">
                <div class="flex items-center border border-gray-200 rounded overflow-hidden">
                  <button class="w-[20px] h-[22px] bg-gray-100 flex items-center justify-center text-[14px]" onclick="Cart.updateQty('${item.itemId || item.productId}', ${item.quantity - 1})">-</button>
                  <span class="px-2 text-[12px]">${item.quantity}</span>
                  <button class="w-[20px] h-[22px] bg-[#BE2229] text-white flex items-center justify-center text-[12px] font-bold" onclick="Cart.updateQty('${item.itemId || item.productId}', ${item.quantity + 1})">+</button>
                </div>
                <div class="text-right">
                  <p class="text-[15px] font-bold text-black">₹${(finalPrice * item.quantity).toFixed(2)}</p>
                </div>
              </div>
              <button class="text-[11px] text-[#BE2229] underline mt-1" onclick="Cart.remove('${item.itemId || item.productId}')">Remove</button>
            </div>
          </div>
        </div>
      `;
      }).join('');
    }
  }

  // ─── Fetch Summary from Backend (Source of Truth) ───
  try {
    const userLoc = JSON.parse(localStorage.getItem('userLocation') || '{}');
    const summaryRes = await apiCall('/user/orders/summary', 'POST', {
      items: items.map(i => ({ product: i.productId, quantity: i.quantity })),
      pincode: userLoc.pincode || "" // Pass pincode if available
    }, Auth.isLoggedIn());

    if (summaryRes.success) {
      totals.itemsTotal = summaryRes.totalAmount;
      totals.deliveryCharge = summaryRes.deliveryCharges;
      totals.totalPayable = summaryRes.finalAmount;
    }
  } catch (err) {
    console.warn('[CART SUMMARY] Using local fallback:', err.message);
  }

  // Update Summary Fields
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('cart-count-desktop', `(${totals.itemCount} Item${totals.itemCount !== 1 ? 's' : ''})`);
  setVal('cart-count-mobile', `(${totals.itemCount} Item${totals.itemCount !== 1 ? 's' : ''})`);
  setVal('summary-items-count', totals.itemCount);
  setVal('summary-quantity-total', `${totals.totalQuantity} Units`);

  setVal('summary-items-total', `₹${totals.itemsTotal.toFixed(2)}`);
  setVal('summary-total-discount', `Applied`);

  const gstRow = document.getElementById('summary-total-gst')?.parentElement;
  if (gstRow) gstRow.style.display = 'none';

  setVal('summary-delivery-charges', totals.deliveryCharge > 0 ? `₹${totals.deliveryCharge.toFixed(2)}` : 'Free');
  setVal('summary-total-payable', `₹${totals.totalPayable.toFixed(2)}`);

  // Mobile Summary Panel
  setVal('mobile-summary-items-label', `Items Total (incl. GST):`);
  setVal('mobile-summary-items-total', `₹${totals.itemsTotal.toFixed(2)}`);
  setVal('mobile-summary-discount', `Applied`);
  setVal('mobile-summary-delivery', totals.deliveryCharge > 0 ? `₹${totals.deliveryCharge.toFixed(2)}` : 'Free');

  const mobGstRow = document.getElementById('mobile-summary-gst')?.parentElement;
  if (mobGstRow) mobGstRow.style.display = 'none';

  setVal('mobile-summary-grand-total', `₹${totals.totalPayable.toFixed(2)}`);

  // Checkout Buttons state
  const checkoutBtnDesktop = document.getElementById('checkout-btn-desktop');
  const checkoutBtnMobile = document.getElementById('checkout-btn-mobile');

  if (items.length > 0) {
    const btnText = Auth.isLoggedIn() ? 'Check Out' : 'Login to Checkout';
    [checkoutBtnDesktop, checkoutBtnMobile].forEach(btn => {
      if (btn) {
        btn.classList.remove('bg-[#D9D9D9]', 'cursor-not-allowed', 'disabled');
        btn.classList.add('bg-[#BE2229]', 'cursor-pointer');
        const span = btn.querySelector('span');
        if (span) {
          span.classList.remove('text-[#A8A3A3]');
          span.classList.add('text-white');
          span.textContent = btnText;
        }
        btn.disabled = false;
        btn.onclick = handleCheckout;
      }
    });
  } else {
    [checkoutBtnDesktop, checkoutBtnMobile].forEach(btn => {
      if (btn) {
        btn.classList.add('bg-[#D9D9D9]', 'cursor-not-allowed', 'disabled');
        btn.classList.remove('bg-[#BE2229]', 'cursor-pointer');
        const span = btn.querySelector('span');
        if (span) {
          span.classList.add('text-[#A8A3A3]');
          span.classList.remove('text-white');
        }
        btn.disabled = true;
        btn.onclick = null;
      }
    });
  }
}


function handleCheckout() {
  if (!Auth.isLoggedIn()) {
    showToast('Please login to checkout', 'info');
    localStorage.setItem("redirectAfterLogin", "checkout.html");
    setTimeout(() => window.location.href = 'login.html', 1200);
    return;
  }
  const cart = Cart.get();
  if (!cart.length) {
    showToast('Your cart is empty', 'warning');
    return;
  }
  window.location.href = 'checkout.html';
}

// ─── Page: checkout.html ─────────────────────────────────────────────────────
async function initCheckoutPage() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const cart = Cart.get();
  if (!cart.length) {
    window.location.href = 'cart.html';
    return;
  }

  const itemsContainer = document.getElementById('checkout-items');
  const totals = Cart.totals();

  // Render items
  if (itemsContainer) {
    itemsContainer.innerHTML = cart.map(item => `
      <div class="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
        <div class="w-[60px] h-[60px] bg-gray-50 rounded flex-shrink-0">
          <img src="${productImg({ images: [item.image] })}" class="w-full h-full object-contain" onerror="this.src='assets/images/deafult.png'">
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-[14px] font-medium text-[#242323] truncate">${item.name}</h4>
          <p class="text-[12px] text-[#A8A3A3]">Qty: ${item.quantity}</p>
        </div>
        <div class="text-[14px] font-bold text-[#BE2229]">₹${(Number(item.finalPrice || 0) * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');
  }

  const totalsContainer = {
    items: document.getElementById('summary-items-total'),
    delivery: document.getElementById('summary-delivery'),
    total: document.getElementById('summary-total')
  };

  const fetchSummary = async (pincode = "") => {
    try {
      const summaryRes = await apiCall('/user/orders/summary', 'POST', {
        items: cart.map(i => ({ product: i.productId, quantity: i.quantity })),
        pincode: pincode
      }, true);
      
      if (summaryRes.success) {
        if (totalsContainer.items) totalsContainer.items.textContent = `₹${summaryRes.totalAmount.toFixed(2)}`;
        if (totalsContainer.delivery) totalsContainer.delivery.textContent = summaryRes.deliveryCharges > 0 ? `₹${summaryRes.deliveryCharges.toFixed(2)}` : 'Free';
        if (totalsContainer.total) totalsContainer.total.textContent = `₹${summaryRes.finalAmount.toFixed(2)}`;
        
        return summaryRes;
      }
    } catch (err) {
      console.error('[SUMMARY ERROR]', err);
    }
    return null;
  };

  const pincodeInput = document.getElementById('ship-pincode');
  let backendSummary = await fetchSummary(pincodeInput?.value || "");

  // Listen for pincode changes to update delivery charges
  pincodeInput?.addEventListener('input', debounce(async (e) => {
    const pin = e.target.value;
    if (pin.length === 6) {
      console.log('[CHECKOUT] Updating totals for pincode:', pin);
      backendSummary = await fetchSummary(pin);
    }
  }, 500));

  // Auto-fill address
  const user = Auth.getUser();
  if (user) {
    const fill = (id, val) => { if (document.getElementById(id) && val) document.getElementById(id).value = val; };
    fill('ship-name', `${user.firstName} ${user.lastName || ''}`.trim());
    fill('ship-phone', user.phoneNumber || '');
    if (user.shippingAddress) {
      fill('ship-address', user.shippingAddress.street || '');
      fill('ship-city', user.shippingAddress.city || '');
      fill('ship-state', user.shippingAddress.state || '');
      fill('ship-pincode', user.shippingAddress.zip || '');
    }
  }

  // Payment Method Selection Logic
  let selectedMethod = 'COD';
  const methodItems = document.querySelectorAll('.payment-method-item');
  methodItems.forEach(item => {
    item.addEventListener('click', () => {
      selectedMethod = item.dataset.method;
      methodItems.forEach(i => {
        const isSelected = i.dataset.method === selectedMethod;
        i.classList.toggle('border-[#BE2229]', isSelected);
        i.classList.toggle('bg-red-50', isSelected);
        i.classList.toggle('border-gray-200', !isSelected);
        i.classList.toggle('bg-white', !isSelected);
        const radioOuter = i.querySelector('.radio-outer');
        if (radioOuter) {
          radioOuter.classList.toggle('border-[#BE2229]', isSelected);
          radioOuter.classList.toggle('border-4', isSelected);
        }
        const radioInner = i.querySelector('.radio-inner');
        if (radioInner) radioInner.classList.toggle('bg-[#BE2229]', isSelected);
      });
    });
  });

  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) {
    placeBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
      const shippingAddress = {
        fullName: getVal('ship-name'),
        phone: getVal('ship-phone'),
        addressLine1: getVal('ship-address'),
        city: getVal('ship-city'),
        state: getVal('ship-state'),
        pincode: getVal('ship-pincode'),
        country: getVal('ship-country') || 'India'
      };

      if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
        showToast('Please fill all delivery details', 'error');
        return;
      }

      // UI: Disable Interaction
      placeBtn.disabled = true;
      placeBtn.innerHTML = '<span class="flex items-center gap-2"><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</span>';

      try {
        // Re-fetch summary to ensure latest pricing from backend
        backendSummary = await fetchSummary();
        if (!backendSummary) throw new Error('Could not verify order totals');

        if (selectedMethod === 'Online') {
          console.log('[CHECKOUT] Starting Online Payment Flow...');
          await handleOnlinePaymentFlow(shippingAddress, backendSummary.finalAmount);
        } else {
          console.log('[CHECKOUT] Starting COD Flow...');
          await handleCODFlow(shippingAddress, backendSummary.finalAmount);
        }
      } catch (err) {
        console.error('[CHECKOUT ERROR]', err);
        showToast(err.message || 'Payment initiation failed', 'error');
        placeBtn.disabled = false;
        placeBtn.textContent = 'Place Order';
      }
    });
  }
}

/**
 * PRODUCTION COD FLOW
 */
async function handleCODFlow(shippingAddress, amount) {
  const cart = Cart.get();
  const payload = {
    items: cart.map(i => ({ product: i.productId, quantity: i.quantity, name: i.name, image: i.image })),
    shippingAddress,
    paymentMethod: 'COD',
    paymentStatus: 'Pending'
  };

  try {
    const res = await apiCall('/user/orders', 'POST', payload, true);
    if (res.success) {
      Cart.save([]);
      showToast('Order placed successfully!', 'success');
      const redirectUrl = `order-success.html?id=${res.orderNumber}&amount=${amount}&awb=${res.tracking?.awb || ''}&tracking=${encodeURIComponent(res.tracking?.url || '')}`;
      window.location.href = redirectUrl;
    } else {
      throw new Error(res.message);
    }
  } catch (err) {
    console.error('[COD ERROR]', err);
    showToast(err.message || 'Failed to place order', 'error');
  }
}

/**
 * PRODUCTION ONLINE FLOW (Verify-then-Create)
 */
async function handleOnlinePaymentFlow(shippingAddress, amount) {
  try {
    // 1. Create Razorpay order on backend
    console.log('[PAYMENT] Creating gateway order...');
    const rzpOrderRes = await apiCall('/payment/create-order', 'POST', { amount }, true);
    if (!rzpOrderRes.success) throw new Error(rzpOrderRes.message);

    // 2. Open Razorpay Popup
    const options = {
      key: rzpOrderRes.key,
      amount: rzpOrderRes.amount,
      currency: rzpOrderRes.currency,
      name: "Springwala",
      description: "Secure Checkout",
      order_id: rzpOrderRes.id,
      handler: async function (response) {
        console.log('[PAYMENT] Gateway success. Verifying signature...');

        try {
          // 3. Verify Payment
          const verifyRes = await apiCall('/payment/verify', 'POST', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }, true);

          if (verifyRes.success) {
            console.log('[PAYMENT] Signature verified. Finalizing DB Order...');

            // 4. Create Order in DB (Marked as Completed)
            const cart = Cart.get();
            const orderPayload = {
              items: cart.map(i => ({ product: i.productId, quantity: i.quantity, name: i.name, image: i.image })),
              shippingAddress,
              paymentMethod: 'Online',
              paymentStatus: 'Completed',
              paymentDetails: {
                transactionId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id
              }
            };

            const finalRes = await apiCall('/user/orders', 'POST', orderPayload, true);
            if (finalRes.success) {
              Cart.save([]);
              showToast('Payment successful!', 'success');
              const redirectUrl = `order-success.html?id=${finalRes.orderNumber}&amount=${amount}&payment=success&awb=${finalRes.tracking?.awb || ''}&tracking=${encodeURIComponent(finalRes.tracking?.url || '')}`;
              window.location.href = redirectUrl;
            } else {
              throw new Error('Payment verified but order creation failed. Please contact support.');
            }
          } else {
            throw new Error('Payment verification failed. Please try again.');
          }
        } catch (err) {
          console.error('[PAYMENT ERROR]', err);
          showToast(err.message, 'error');
        }
      },
      prefill: {
        name: shippingAddress.fullName,
        contact: shippingAddress.phone
      },
      theme: { color: "#BE2229" },
      modal: {
        ondismiss: function () {
          console.warn('[PAYMENT] Modal closed.');
          const placeBtn = document.getElementById('place-order-btn');
          if (placeBtn) {
            placeBtn.disabled = false;
            placeBtn.textContent = 'Place Order';
          }
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (res) {
      showToast('Payment Failed: ' + res.error.description, 'error');
    });
    rzp.open();

  } catch (err) {
    throw err;
  }
}


async function loadRecommendedProducts() {
  const slider = document.getElementById('product-slider');
  if (!slider) return;
  try {
    // Fetch top sold and latest products in parallel
    const [topData, latestData] = await Promise.all([
      apiCall('/user/products/top-sold?limit=10'),
      apiCall('/user/products/latest?limit=10')
    ]);

    // Combine them and ensure uniqueness by ID
    const combined = [...(topData.products || []), ...(latestData.products || [])];
    const unique = [];
    const seen = new Set();

    combined.forEach(p => {
      if (!seen.has(p._id)) {
        unique.push(p);
        seen.add(p._id);
      }
    });

    // Render cards
    slider.innerHTML = unique.map(p => buildProductCard(p, 'min-w-[171px] max-w-[171px]')).join('');

    // Update the "1-6 of X" label if it exists
    const pageInfo = document.getElementById('slider-page-info');
    if (pageInfo) {
      const visible = Math.min(6, unique.length);
      pageInfo.textContent = `1–${visible} of ${unique.length}`;
    }
  } catch (e) {
    console.warn('Recommended load failed:', e.message);
  }
}

// ─── Page: orders.html ────────────────────────────────────────────────────────
async function initOrdersPage() {
  if (!Auth.isLoggedIn()) {
    // Show login prompt
    return;
  }
  try {
    const data = await apiCall('/user/orders?limit=20', 'GET', null, true);
    const orders = data.orders || [];

    const undelivered = orders.filter(o => !['delivered', 'completed'].includes(o.status));
    const delivered = orders.filter(o => ['delivered', 'completed'].includes(o.status));

    // Desktop: undelivered tab
    const desktopLeft = document.querySelector('.hidden.md\\:block .flex-1.min-w-0');
    if (desktopLeft) {
      const cardArea = desktopLeft.querySelector('.w-full.bg-white.border');
      if (orders.length > 0) {
        // Replace placeholder cards with real data
        const placeholder = desktopLeft.querySelectorAll('.w-full.bg-white.border.border-\\[\\#E4E4E4\\].rounded-\\[10px\\]');
        placeholder.forEach((c, i) => {
          const order = undelivered[i];
          if (order) {
            const item = order.items[0];
            c.querySelector('h3').textContent = item?.name || 'Product';
            c.querySelector('img').src = item?.image || 'assets/images/deafult.png';
            const priceEl = c.querySelector('.text-\\[26px\\]');
            if (priceEl) priceEl.textContent = `₹${order.totalAmount?.toFixed(2) || '0.00'}`;
            const pill = c.querySelector('.bg-\\[\\#1B99B5\\]');
            if (pill && order.estimatedDelivery) {
              pill.querySelector('span').textContent = `Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            }
          } else {
            c.style.display = 'none';
          }
        });
      }
    }

    // Mobile sections
    const mobileUndelivered = document.querySelector('.md\\:hidden .flex.flex-col.gap-4:first-of-type');
    if (mobileUndelivered && undelivered.length) {
      mobileUndelivered.innerHTML = undelivered.map(order => {
        const item = order.items[0];
        const img = item?.image || 'assets/images/deafult.png';
        return `
          <div class="w-full bg-white border border-[#E4E4E4] rounded-[10px] p-[16px]">
            <div class="flex items-start gap-[12px] mb-[12px]">
              <div class="w-[64px] h-[64px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img src="${img}" alt="${item?.name || 'Product'}" class="max-w-full max-h-full object-contain" onerror="this.src='assets/images/deafult.png'">
              </div>
              <div class="flex flex-col flex-1 min-w-0">
                <div class="flex justify-between items-start gap-2">
                  <h3 class="text-[#000000] text-[15px] font-medium font-['Poppins'] leading-[22px] line-clamp-2">${item?.name || 'Product'}</h3>
                </div>
                <div class="inline-flex items-center px-[6px] py-[2px] bg-[#1B99B5] rounded-[2px] w-fit mt-[4px]">
                  <span class="text-white text-[10px] font-medium font-['Poppins'] leading-[15px]">
                    ${order.estimatedDelivery ? 'Est. Delivery: ' + new Date(order.estimatedDelivery).toLocaleDateString('en-IN') : 'Order placed: ' + new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-[8px] overflow-x-auto">
              <button class="bg-[#E2E2E2] rounded-[3px] px-[10px] py-[6px] flex-shrink-0 text-[#4D4848] text-[12px] font-medium">Track Order</button>
              <button class="bg-[#E2E2E2] rounded-[3px] px-[10px] py-[6px] flex-shrink-0 text-[#4D4848] text-[12px] font-medium">Customer Support</button>
              <button class="bg-[#E2E2E2] rounded-[3px] px-[10px] py-[6px] flex-shrink-0 text-[#4D4848] text-[12px] font-medium" onclick="addOrderToCart('${order._id}')">Order Again</button>
            </div>
          </div>`;
      }).join('');
    }

    // Delivered
    const mobileDelivered = document.querySelectorAll('.md\\:hidden .flex.flex-col.gap-4');
    const deliveredContainer = mobileDelivered[1];
    if (deliveredContainer && delivered.length) {
      deliveredContainer.innerHTML = delivered.map(order => {
        const item = order.items[0];
        const img = item?.image || 'assets/images/deafult.png';
        return `
          <div class="w-full bg-white border border-[#E4E4E4] rounded-[10px] p-[16px]">
            <div class="flex items-start gap-[12px] mb-[12px]">
              <div class="w-[64px] h-[64px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img src="${img}" alt="${item?.name || 'Product'}" class="max-w-full max-h-full object-contain" onerror="this.src='assets/images/deafult.png'">
              </div>
              <div class="flex flex-col flex-1 min-w-0">
                <h3 class="text-[15px] font-medium font-['Poppins'] line-clamp-2">${item?.name || 'Product'}</h3>
                <div class="inline-flex items-center px-[6px] py-[2px] bg-[#096709] rounded-[2px] w-fit mt-[4px]">
                  <span class="text-white text-[10px] font-medium">Delivered on ${new Date(order.updatedAt).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-[8px] overflow-x-auto">
              <button class="bg-[#E2E2E2] rounded-[3px] px-[10px] py-[6px] flex-shrink-0 text-[12px] font-medium">Write a Review</button>
              <button class="bg-[#42AD42] rounded-[3px] px-[10px] py-[6px] flex-shrink-0 text-white text-[12px] font-medium" onclick="addOrderToCart('${order._id}')">Re-order</button>
            </div>
          </div>`;
      }).join('');
    }

    // Related products slider
    const relatedSlider = document.getElementById('orders-product-slider');
    if (relatedSlider) {
      try {
        const featData = await apiCall('/user/products/featured?limit=12');
        relatedSlider.innerHTML = (featData.products || []).map(p => buildProductCard(p, 'min-w-[171px] max-w-[171px]')).join('');
      } catch { }
    }

  } catch (e) {
    console.warn('Orders load failed:', e.message);
  }
}

async function addOrderToCart(orderId) {
  showToast('Adding items to cart...', 'info');
  try {
    const data = await apiCall(`/user/orders/${orderId}`, 'GET', null, true);
    if (data.order?.items) {
      data.order.items.forEach(item => {
        Cart.add(item.product, item.name, item.image, item.price, item.discountedPrice, item.quantity);
      });
      showToast('Items added to cart!', 'success');
    }
  } catch {
    showToast('Could not re-order. Please try again.', 'error');
  }
}

// ─── Page: profile.html ───────────────────────────────────────────────────────
// ─── Page: profile.html ───────────────────────────────────────────────────────
async function initProfilePage() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  // Trigger location request ONLY on profile page if not asked before
  requestLocationPermission();

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') el.value = val || '';
    else el.textContent = val || '';
  };

  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

  try {
    const data = await apiCall('/user/profile', 'GET', null, true);
    const user = data.user;
    if (!user) return;

    Auth.setUser(user);

    // Display in sidebar
    setVal('profile-display-name', `${user.firstName} ${user.lastName || ''}`.trim());
    setVal('profile-display-email', user.email || user.phoneNumber || '');
    if (user.profileImage) {
      const img = document.getElementById('profile-image');
      if (img) img.src = user.profileImage.startsWith('http') ? user.profileImage : API_BASE.replace('/api', '') + user.profileImage;
    }

    // Populate My Profile
    setVal('profile-first-name', user.firstName);
    setVal('profile-last-name', user.lastName);
    setVal('profile-phone', user.phoneNumber?.replace(/^\+91/, ''));
    setVal('profile-email', user.email);
    setVal('profile-alt-phone', user.alternatePhone);
    setVal('profile-country', user.country || 'Your Country');
    setVal('profile-state', user.state || 'Your State');

    // Populate Company Profile
    const cp = user.companyProfile || {};
    setVal('company-name', cp.companyName);
    setVal('company-industry', cp.industry);
    setVal('company-type', cp.companyType);
    setVal('company-country', cp.country);
    setVal('company-state', cp.state);
    setVal('company-website', cp.website);
    setVal('company-email', cp.email);
    setVal('company-phone', cp.phone);
    setVal('company-address', cp.address);

    // Populate GSTIN
    const gst = user.gstin || {};
    setVal('gstin-number', gst.number);
    setVal('gstin-pan', gst.pan);

    // Populate Billing
    const bill = user.billingAddress || {};
    setVal('billing-street', bill.street);
    setVal('billing-apartment', bill.apartment);
    setVal('billing-city', bill.city);
    setVal('billing-state', bill.state);
    setVal('billing-country', bill.country);
    setVal('billing-zip', bill.zip);
    setVal('billing-phone', bill.phone);

    // Populate Shipping
    const ship = user.shippingAddress || {};
    setVal('shipping-street', ship.street);
    setVal('shipping-apartment', ship.apartment);
    setVal('shipping-city', ship.city);
    setVal('shipping-state', ship.state);
    setVal('shipping-country', ship.country);
    setVal('shipping-zip', ship.zip);
    setVal('shipping-phone', ship.phone);

    // ─── Profile UX Helpers ───

    // 1. Phone Validation (10 digits)
    const phoneFields = ['profile-phone', 'profile-alt-phone', 'company-phone', 'billing-phone', 'shipping-phone'];
    phoneFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
      }
    });

    // 2. Indian States Autocomplete
    const INDIAN_STATES = [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
      "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
      "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
    ];
    const stateList = document.getElementById('state-list');
    const countryInputs = ['profile-country', 'company-country', 'billing-country', 'shipping-country'];

    const updateStates = (country) => {
      if (!stateList) return;
      stateList.innerHTML = '';
      if (country?.toLowerCase() === 'india') {
        INDIAN_STATES.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          stateList.appendChild(opt);
        });
      }
    };

    countryInputs.forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('input', (e) => updateStates(e.target.value));
        if (inp.value) updateStates(inp.value);
      }
    });

    // Helper to update profile
    const saveProfile = async (payload) => {
      try {
        const res = await apiCall('/user/profile', 'PUT', payload, true);
        if (res.success) {
          Auth.setUser(res.user);
          updateHeaderUser(res.user);
          showToast('Profile updated successfully!', 'success');
          // Update sidebar display if names changed
          setVal('profile-display-name', `${res.user.firstName} ${res.user.lastName || ''}`.trim());
        }
      } catch (e) {
        showToast(e.message, 'error');
      }
    };

    // Event Listeners for Buttons
    document.getElementById('update-profile-btn')?.addEventListener('click', () => {
      const country = getVal('profile-country');
      const state = getVal('profile-state');

      // Update local storage if manually changed
      localStorage.setItem('userLocation', JSON.stringify({ country, state }));
      updateNavbarLocation({ country, state });

      saveProfile({
        firstName: getVal('profile-first-name'),
        lastName: getVal('profile-last-name'),
        phoneNumber: getVal('profile-phone'),
        alternatePhone: getVal('profile-alt-phone'),
        country,
        state
      });
    });

    document.getElementById('update-company-btn')?.addEventListener('click', () => {
      saveProfile({
        companyProfile: {
          companyName: getVal('company-name'),
          industry: getVal('company-industry'),
          companyType: getVal('company-type'),
          country: getVal('company-country'),
          state: getVal('company-state'),
          website: getVal('company-website'),
          email: getVal('company-email'),
          phone: getVal('company-phone'),
          address: getVal('company-address'),
        }
      });
    });

    document.getElementById('update-gstin-btn')?.addEventListener('click', () => {
      saveProfile({
        gstin: {
          number: getVal('gstin-number'),
          pan: getVal('gstin-pan'),
        }
      });
    });

    document.getElementById('save-billing-btn')?.addEventListener('click', () => {
      saveProfile({
        billingAddress: {
          street: getVal('billing-street'),
          apartment: getVal('billing-apartment'),
          city: getVal('billing-city'),
          state: getVal('billing-state'),
          country: getVal('billing-country'),
          zip: getVal('billing-zip'),
          phone: getVal('billing-phone'),
        }
      });
    });

    document.getElementById('save-shipping-btn')?.addEventListener('click', () => {
      saveProfile({
        shippingAddress: {
          street: getVal('shipping-street'),
          apartment: getVal('shipping-apartment'),
          city: getVal('shipping-city'),
          state: getVal('shipping-state'),
          country: getVal('shipping-country'),
          zip: getVal('shipping-zip'),
          phone: getVal('shipping-phone'),
        }
      });
    });

    // Shipping Same as Billing Sync Logic
    const sameAsBillingCb = document.getElementById('same-as-billing');
    if (sameAsBillingCb) {
      const billingFields = ['street', 'apartment', 'city', 'state', 'country', 'zip', 'phone'];
      const syncAddresses = () => {
        if (sameAsBillingCb.checked) {
          billingFields.forEach(f => {
            const billVal = getVal(`billing-${f}`);
            setVal(`shipping-${f}`, billVal);
            const shipEl = document.getElementById(`shipping-${f}`);
            if (shipEl) {
              shipEl.readOnly = true;
              shipEl.parentElement.classList.add('opacity-70');
            }
          });
        } else {
          billingFields.forEach(f => {
            const shipEl = document.getElementById(`shipping-${f}`);
            if (shipEl) {
              shipEl.readOnly = false;
              shipEl.parentElement.classList.remove('opacity-70');
            }
          });
        }
      };

      sameAsBillingCb.addEventListener('change', syncAddresses);

      // Also sync on billing field input if checkbox is checked
      billingFields.forEach(f => {
        document.getElementById(`billing-${f}`)?.addEventListener('input', () => {
          if (sameAsBillingCb.checked) {
            setVal(`shipping-${f}`, getVal(`billing-${f}`));
          }
        });
      });

      // Auto-check if addresses match on load (and aren't empty)
      const isSame = billingFields.every(f => {
        const b = getVal(`billing-${f}`);
        const s = getVal(`shipping-${f}`);
        return b === s && b !== '';
      });
      if (isSame) {
        sameAsBillingCb.checked = true;
        syncAddresses();
      }
    }

    // Change password (keep existing)
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.trim() === 'Update Password') {
        btn.addEventListener('click', async () => {
          const pwInputs = document.querySelectorAll('#manage-password-form-container input[type="password"]');
          const current = pwInputs[0]?.value;
          const newPw = pwInputs[1]?.value;
          const confirm = pwInputs[2]?.value;
          if (!current || !newPw || !confirm) { showToast('All fields required', 'error'); return; }
          if (newPw !== confirm) { showToast('Passwords do not match', 'error'); return; }
          try {
            await apiCall('/user/change-password', 'PUT', { currentPassword: current, newPassword: newPw }, true);
            showToast('Password updated!', 'success');
            pwInputs.forEach(i => i.value = '');
          } catch (e) { showToast(e.message, 'error'); }
        });
      }
    });

    // Logout button
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.trim() === 'Logout') btn.addEventListener('click', Auth.logout);
    });

    // My Orders tab
    document.getElementById('sidebar-tab-orders')?.addEventListener('click', async () => {
      const container = document.getElementById('orders-form-container');
      if (!container || container.dataset.loaded) return;
      container.dataset.loaded = '1';
      try {
        const oData = await apiCall('/user/orders?limit=5', 'GET', null, true);
        const orders = oData.orders || [];
        const emptyState = container.querySelector('.flex.flex-col.items-center');
        if (orders.length && emptyState) {
          emptyState.outerHTML = `<div class="flex flex-col gap-4">${orders.map(o => {
            const item = o.items[0];
            const statusColor = o.status === 'delivered' ? '#096709' : '#1B99B5';
            return `<div class="w-full bg-[#F9F9F9] border border-[#E4E4E4] rounded-[8px] p-4 flex gap-3 items-start">
              <img src="${item?.image || 'assets/images/deafult.png'}" class="w-[60px] h-[60px] object-contain flex-shrink-0" onerror="this.src='assets/images/deafult.png'">
              <div>
                <h4 class="text-[14px] font-medium font-['Poppins']">${item?.name || 'Order'}</h4>
                <span style="background:${statusColor}" class="inline-block px-2 py-0.5 rounded text-white text-[11px] mt-1 font-medium">${o.status?.toUpperCase()}</span>
                <p class="text-[12px] text-[#747474] mt-1">₹${o.totalAmount?.toFixed(2) || '0'} • ${new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>`;
          }).join('')}</div>`;
        }
      } catch { }
    });

  } catch (e) {
    console.warn('Profile load failed:', e.message);
  }
}

// Global helper for profile image upload
async function loadProfileImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('profileImage', file);

  showToast('Uploading image...', 'info');

  try {
    const res = await fetch(API_BASE + '/user/upload-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');

    // Update UI
    const newPath = data.profileImage;
    const fullUrl = newPath.startsWith('http') ? newPath : IMAGE_BASE + newPath;

    const profileImg = document.getElementById('profile-image');
    if (profileImg) profileImg.src = fullUrl;

    // Update Header too
    document.querySelectorAll('.header-user-icon').forEach(el => {
      el.src = fullUrl;
      el.classList.add('object-cover', 'rounded-full');
    });

    // Update Auth store
    Auth.setUser(data.user);

    showToast('Profile image updated!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.loadProfileImage = loadProfileImage;

function fillProfileLocationFields(location) {
  if (!location) return;
  
  const countryEl = document.getElementById('profile-country');
  const stateEl = document.getElementById('profile-state');

  // Only fill if empty to avoid overriding user input
  if (countryEl && (!countryEl.value || countryEl.value === 'Your Country')) {
    countryEl.value = location.country || "";
  }
  if (stateEl && (!stateEl.value || stateEl.value === 'Your State')) {
    stateEl.value = location.state || "";
  }
}
window.fillProfileLocationFields = fillProfileLocationFields;

// ─── Page: categories.html ────────────────────────────────────────────────────
async function initCategoriesPage() {
  const grid = document.querySelector('.grid.grid-cols-2.gap-\\[18px\\]');
  if (!grid) return;
  try {
    const data = await apiCall('/user/categories');
    const cats = data.categories || [];
    if (!cats.length) return;

    grid.innerHTML = cats.map(c => {
      const img = c.banner ? (c.banner.startsWith('http') ? c.banner : `${IMAGE_BASE}/uploads/${c.banner}`) : 'assets/images/deafult.png';
      return `
        <a href="allproducts.html?category=${c._id}" class="bg-white border border-[rgba(234,234,234,0.63)] rounded-[8px] shadow-[0px_2px_4px_rgba(0,0,0,0.25)] flex flex-col items-center justify-end h-[119px] relative hover:shadow-md transition">
          <div class="w-full h-[78px] flex items-center justify-center absolute top-2">
            <img src="${img}" alt="${c.name}" class="max-w-[147px] max-h-full object-contain" onerror="this.src='assets/images/deafult.png'">
          </div>
          <span class="text-[#363636] font-medium font-['Poppins'] text-[14px] mb-2 z-10 text-center px-2 leading-tight">${c.name}</span>
        </a>`;
    }).join('');
  } catch { }
}

// ─── Initialise ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // DEBUG MODE: Log auth state for mobile troubleshooting
  console.log("--- [Springwala Auth Debug] ---");
  console.log("Page:", window.location.pathname);
  console.log("Token exists:", !!Auth.getToken());
  console.log("User cached:", !!Auth.getUser());
  console.log("------------------------------");

  // Inject CSS for animations and mobile states
  if (!document.getElementById('sw-styles')) {
    const style = document.createElement('style');
    style.id = 'sw-styles';
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      .hidden-menu { transform: translateX(-100%); transition: transform 0.3s ease-in-out; }
      .show-menu   { transform: translateX(0);     transition: transform 0.3s ease-in-out; }
      .disabled-btn { opacity: 0.4; pointer-events: none; cursor: not-allowed; }
      .overflow-hidden { overflow: hidden !important; }
      #mobile-sub-header { transition: max-height 0.3s ease-out, opacity 0.3s ease-out; }
      #mobile-sub-header.hide-sub { max-height: 0; opacity: 0; pointer-events: none; }
    `;
    document.head.appendChild(style);
  }

  // 1. Auth Validation (Critical Fix)
  if (Auth.isLoggedIn()) {
    // Show a subtle loading state to prevent stale UI flicker
    const loader = document.createElement('div');
    loader.id = 'auth-loader';
    loader.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:9999; display:flex; align-items:center; justify-center; opacity:0.8; transition: opacity 0.3s;';
    loader.innerHTML = '<div style="width:40px; height:40px; border:4px solid #f3f3f3; border-top:4px solid #BE2229; border-radius:50%; animation: spin 1s linear infinite;"></div>';
    document.body.appendChild(loader);

    await validateUser();

    // Fade out loader
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);
  }

  // 2. Patch ALL Account/Profile links (Critical Mobile Fix)
  const user = Auth.getUser();
  // We target any link going to login.html or having account-related classes/images
  document.querySelectorAll('a[href="login.html"], a[href="profile.html"], .nav-profile-link, .mobile-account-link').forEach(a => {
    const span = a.querySelector('span');
    const img = a.querySelector('img');
    const text = a.textContent.trim();

    const isProfileLink =
      text.includes('Your Account') ||
      text.includes('My Account') ||
      text.includes('Profile') ||
      (span && (span.textContent.includes('Your Account') || span.textContent.includes('Profile'))) ||
      (img && (img.alt.includes('Account') || img.alt.includes('Profile'))) ||
      a.classList.contains('mobile-account-link');

    if (isProfileLink) {
      // Prevent default navigation and use our dynamic handler
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToAccount();
      });

      if (user) {
        const isInsideMobileMenu = a.closest('#mobile-menu');
        const displayName = isInsideMobileMenu ? "My Profile" : `Hi, ${user.firstName}`;

        if (span && (span.textContent.includes('Your Account') || span.textContent.includes('My Account') || span.classList.contains('header-account-text'))) {
          span.textContent = displayName;
          span.classList.add('header-account-text');
        } else if (text.includes('Your Account') || text.includes('My Account')) {
          a.textContent = displayName;
        }

        // Update profile image if available
        if (user.profileImage && img) {
          img.src = user.profileImage.startsWith('http') ? user.profileImage : IMAGE_BASE + user.profileImage;
          img.classList.add('header-user-icon', 'object-cover', 'rounded-full');
        }

        a.href = 'profile.html';
      } else {
        a.href = 'login.html';
      }
    }
  });

  // 3. Dynamic Logout in Mobile Menu
  if (user) {
    const mobileMenuUl = document.querySelector('#mobile-menu ul');
    if (mobileMenuUl && !document.querySelector('.mobile-logout-item')) {
      const logoutLi = document.createElement('li');
      logoutLi.className = 'flex items-center gap-3 mobile-logout-item';
      logoutLi.innerHTML = `
            <span class="w-2 h-2 bg-transparent rounded-full"></span>
            <a href="#" class="logout-trigger text-red-600 font-medium">Logout</a>
          `;
      mobileMenuUl.appendChild(logoutLi);
      logoutLi.querySelector('.logout-trigger').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }
  }

  // Desktop location text
  const desktopLocEl = document.querySelectorAll('.text-\\[\\#242323\\].text-\\[12px\\].font-medium');
  desktopLocEl.forEach(el => {
    if (el.textContent === 'Thane, Maharashtra') el.classList.add('desktop-location-text');
  });

  // Global Logout integration for any button with id or class
  document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);
  document.querySelectorAll('.logout-trigger').forEach(btn => btn.addEventListener('click', Auth.logout));

  initLocation();
  initMobileMenu();
  initStickyHeader();
  initFilterDrawer();
  initSearch();
  loadCartCount();

  // Highlight active nav items (desktop & mobile)
  const currentPage = document.body.dataset.page;
  if (currentPage) {
    // Desktop Nav
    document.querySelectorAll(`ul.flex li a[href*="${currentPage}"]`).forEach(a => {
      a.parentElement.classList.add('text-[#BE2229]', 'font-medium');
    });
    // ─── Mobile Bottom Navigation ──────────────────────────────────────────────
    const bottomNav = document.querySelector('.mobile-navbar');
    if (bottomNav) {
      const pageId = document.body.dataset.page || 'index';
      bottomNav.querySelectorAll('.nav-item').forEach(item => {
        const itemPage = item.dataset.page;

        // Active State Logic
        if (itemPage === pageId || (pageId === 'index' && itemPage === 'home')) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }

        // Standardized Click Handler
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const target = item.dataset.page;
          if (target === 'home') window.location.href = 'index.html';
          else if (target === 'categories') window.location.href = 'categories.html';
          else if (target === 'cart') window.location.href = 'cart.html';
          else if (target === 'wishlist') window.location.href = 'wishlist.html';
          else if (target === 'profile') {
            if (Auth.isLoggedIn()) window.location.href = 'profile.html';
            else window.location.href = 'login.html';
          }
        });
      });
    }
  }

  // Global Routing Helper
  window.goTo = function (page) {
    window.location.href = page;
  };


  // Better page detection using data-page attribute or pathname
  const bodyPage = document.body.dataset.page || window.location.pathname.split('/').pop().replace('.html', '') || 'index';

  if (bodyPage === 'index' || bodyPage === '') initHomePage();
  if (bodyPage === 'allproducts') initAllProductsPage();
  if (bodyPage === 'product') initProductPage();
  if (bodyPage === 'cart') initCartPage();
  if (bodyPage === 'orders') initOrdersPage();
  if (bodyPage === 'profile') initProfilePage();
  if (bodyPage === 'categories') initCategoriesPage();
  if (bodyPage === 'checkout') initCheckoutPage();
  if (bodyPage === 'wishlist') initWishlistPage();

  Wishlist.sync();
});

/**
 * REUSABLE PAGINATION UI UPDATER
 * Calculates boundaries and disables buttons accordingly.
 */
function updatePaginationUI(paginationId, currentPage, totalItems, perPage) {
  const pag = document.getElementById(paginationId);
  if (!pag) return;

  const totalPages = Math.ceil(totalItems / perPage);
  const prevBtn = pag.querySelector('.prev-btn');
  const nextBtn = pag.querySelector('.next-btn');

  if (prevBtn) {
    if (currentPage === 0) prevBtn.classList.add('disabled-btn');
    else prevBtn.classList.remove('disabled-btn');
  }

  if (nextBtn) {
    if (currentPage + 1 >= totalPages) nextBtn.classList.add('disabled-btn');
    else nextBtn.classList.remove('disabled-btn');
  }
}
