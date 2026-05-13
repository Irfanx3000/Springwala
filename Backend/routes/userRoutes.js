/**
 * routes/userRoutes.js  —  mounted at /api/user
 *
 * Combines all user-facing functionality in one router:
 *   - Profile          (protected - user JWT)
 *   - Cart             (protected - user JWT)
 *   - Orders           (protected - user JWT)
 *   - Product browsing (public)
 *   - Categories       (public)
 *
 * Uses protectUser from middleware/userAuth.js which checks:
 *   1. Token exists
 *   2. decoded.role === 'user'  ← rejects admin tokens
 *   3. User exists in DB
 *   4. User is not blocked (isActive)
 */
const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/userAuth');

const { getProfile, updateProfile, changePassword, uploadProfileImage } = require('../controllers/userController');
const { uploadUser } = require('../middleware/upload');

const {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart, mergeCart
} = require('../controllers/userCartController');

const {
  placeOrder, getMyOrders, getOrder, cancelOrder, getOrderSummary, trackOrder, trackOrderById
} = require('../controllers/userOrderController');

const {
  getProducts, getFeaturedProducts, getTopSoldProducts,
  getLatestProducts, getProduct, getRelatedProducts,
  getCategories, searchProducts,
} = require('../controllers/userProductController');

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', protectUser, getProfile);
router.put('/profile', protectUser, updateProfile);
router.post('/upload-image', protectUser, uploadUser.single('profileImage'), uploadProfileImage);
router.put('/change-password', protectUser, changePassword);

// ── Cart  (/clear must be registered before /:itemId) ─────────────────────────
router.get('/cart', protectUser, getCart);
router.post('/cart/add', protectUser, addToCart);
router.post('/cart/merge', protectUser, mergeCart);
router.put('/cart/:itemId', protectUser, updateCartItem);
router.delete('/cart/clear', protectUser, clearCart);
router.delete('/cart/:itemId', protectUser, removeFromCart);

// ── User orders ───────────────────────────────────────────────────────────────
router.post('/orders/summary', getOrderSummary);
router.post('/orders', protectUser, placeOrder);
router.get('/orders', protectUser, getMyOrders);
router.get('/orders/:id', protectUser, getOrder);
router.post('/orders/:id/cancel', protectUser, cancelOrder);
router.get('/orders/:id/track', protectUser, trackOrderById);
router.get('/orders/track/:awb', trackOrder);

// ── Wishlist ──────────────────────────────────────────────────────────────────
const { getWishlist, toggleWishlist } = require('../controllers/userWishlistController');
router.get('/wishlist', protectUser, getWishlist);
router.post('/wishlist/toggle', protectUser, toggleWishlist);

// ── Public product browsing (specific routes must come before /:id) ───────────
router.get('/products/search', searchProducts);
router.get('/products/featured', getFeaturedProducts);
router.get('/products/top-sold', getTopSoldProducts);
router.get('/products/latest', getLatestProducts);
router.get('/products', getProducts);
router.get('/products/:id/related', getRelatedProducts);
router.get('/products/:id', getProduct);

// ── Public categories & banners ───────────────────────────────────────────────
router.get('/categories', getCategories);

const { getBanners } = require('../controllers/bannerController');
router.get('/banners', getBanners);

module.exports = router;
