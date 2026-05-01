const Cart    = require('../models/Cart');
const Product = require('../models/Product');

// ─── Helper: fetch or create cart for user ────────────────────────────────────
async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate('items.product', 'name images price discountedPrice stock isActive');
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// ─── GET /api/user/cart ───────────────────────────────────────────────────────
exports.getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/user/cart/add ──────────────────────────────────────────────────
// Body: { productId, quantity?, batchQuantity?, batchPrice?, variantName?, variantValue? }
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, batchQuantity, batchPrice, variantName, variantValue } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required.' });
    }

    // Validate product exists and is active
    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable.' });
    }

    // Check stock
    const qty = Number(quantity);
    const bQty = Number(batchQuantity || 1);
    const totalUnits = qty * bQty;

    if (product.stock < totalUnits) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} unit(s) available in stock.`,
      });
    }

    const cart = await getOrCreateCart(req.user._id);

    // Check if same product (and variant) already in cart
    const existingIndex = cart.items.findIndex(item => {
      const sameProduct = item.product.toString() === productId.toString();
      const sameBatch = item.batchQuantity === bQty;
      const sameVariant = (!variantName && !item.variant?.name) ||
        (item.variant?.name === variantName && item.variant?.value === variantValue);
      return sameProduct && sameBatch && sameVariant;
    });

    if (existingIndex > -1) {
      // Increase quantity
      const newPacks = cart.items[existingIndex].quantity + qty;
      const newTotalUnits = newPacks * bQty;
      if (product.stock < newTotalUnits) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} unit(s) available. You already have ${cart.items[existingIndex].quantity * bQty} in your cart.`,
        });
      }
      cart.items[existingIndex].quantity = newPacks;
    } else {
      // Add new item
      cart.items.push({
        product:         product._id,
        name:            product.name,
        image:           product.images?.[0] || '',
        price:           product.price,
        discountedPrice: product.discountedPrice || 0,
        quantity:        qty,
        batchQuantity:   bQty,
        batchPrice:      Number(batchPrice || product.discountedPrice || product.price),
        variant: variantName ? { name: variantName, value: variantValue } : undefined,
      });
    }

    await cart.save();
    await cart.populate('items.product', 'name images price discountedPrice stock isActive');

    res.json({ success: true, message: 'Item added to cart.', cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /api/user/cart/:itemId ───────────────────────────────────────────────
// Body: { quantity }  — set exact quantity (not delta)
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);

    if (!qty || qty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart.' });

    // Validate stock
    const product = await Product.findById(item.product).select('stock');
    if (product && product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} unit(s) available.`,
      });
    }

    item.quantity = qty;
    await cart.save();
    await cart.populate('items.product', 'name images price discountedPrice stock isActive');

    res.json({ success: true, message: 'Cart updated.', cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /api/user/cart/:itemId ───────────────────────────────────────────
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

    const itemExists = cart.items.id(req.params.itemId);
    if (!itemExists) return res.status(404).json({ success: false, message: 'Item not found in cart.' });

    cart.items.pull(req.params.itemId);
    await cart.save();

    res.json({ success: true, message: 'Item removed from cart.', cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /api/user/cart ────────────────────────────────────────────────────
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.json({ success: true, message: 'Cart is already empty.' });

    cart.items = [];
    await cart.save();
    res.json({ success: true, message: 'Cart cleared.', cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/user/cart/merge ────────────────────────────────────────────────
// Body: { items: [{ productId, quantity }] }
exports.mergeCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required.' });
    }

    const cart = await getOrCreateCart(req.user._id);

    for (const item of items) {
      const { productId, quantity = 1 } = item;
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) continue;

      const qty = Number(quantity);
      const existingIndex = cart.items.findIndex(i => i.product?._id.toString() === productId.toString());

      if (existingIndex > -1) {
        const newQty = cart.items[existingIndex].quantity + qty;
        cart.items[existingIndex].quantity = Math.min(newQty, product.stock);
      } else {
        cart.items.push({
          product:         product._id,
          name:            product.name,
          image:           product.images?.[0] || '',
          price:           product.price,
          discountedPrice: product.discountedPrice || 0,
          quantity:        Math.min(qty, product.stock),
        });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'name images price discountedPrice stock isActive');

    res.json({ success: true, message: 'Cart merged successfully.', cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
