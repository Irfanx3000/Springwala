const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

// ─── INITIALIZATION ──────────────────────────────────────────────────────────
const KEY_ID = (process.env.RAZORPAY_KEY_ID || '').trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || '').trim();

if (!KEY_ID || !KEY_SECRET) {
  console.error('[RAZORPAY] CRITICAL ERROR: API Keys are missing in .env');
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

/**
 * ─── POST /api/payment/create-order ──────────────────────────────────────────
 * Creates a Razorpay Order for online payments.
 * Note: This happens BEFORE the DB order is created for Online payments.
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    console.log('[RAZORPAY] Create Order Payload:', JSON.stringify(req.body, null, 2));
    const { items: rawItems, shippingAddress, currency = "INR", receipt = `rcpt_${Date.now()}` } = req.body;

    // 1. Strict Validation & Normalization
    if (!rawItems) {
      return res.status(400).json({ success: false, message: 'Items array is missing from payload' });
    }
    if (!Array.isArray(rawItems)) {
      return res.status(400).json({ success: false, message: 'Items must be a valid array' });
    }
    if (rawItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty. Items are required to create a payment order.' });
    }

    // Normalize items to ensure backend compatibility (Support legacy formats)
    const items = rawItems.map((item, index) => {
      const productId = item.productId || item.product || item._id;
      const quantity = Number(item.quantity || 0);

      if (!productId) {
        throw new Error(`Item at index ${index} is missing a product identifier (productId/product/_id)`);
      }
      if (quantity <= 0) {
        throw new Error(`Item at index ${index} (${item.name || productId}) has an invalid quantity: ${quantity}`);
      }

      return {
        ...item,
        product: productId, // Standardize on 'product' for calculatePricing
        productId: productId,
        quantity: quantity
      };
    });

    console.log('[RAZORPAY] Normalized Items:', JSON.stringify(items, null, 2));

    // 2. Calculate amount on backend (SSOT)
    const { calculatePricing } = require('./userOrderController');
    const pincode = shippingAddress?.pincode;
    
    const pricing = await calculatePricing(items, pincode);
    const amount = pricing.finalAmount;

    if (!amount || amount <= 0) {
      console.error('[RAZORPAY] Calculation failed. Resulting pricing:', pricing);
      return res.status(400).json({ 
        success: false, 
        message: 'Could not calculate valid order amount. Some items may be unavailable.',
        details: pricing
      });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt,
    };

    console.log(`[RAZORPAY] Requesting Gateway Order:`, options);
    const razorpayOrder = await razorpay.orders.create(options);
    console.log(`[RAZORPAY] Gateway Order Created: ${razorpayOrder.id}`);

    res.status(200).json({
      success: true,
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: KEY_ID,
    });
  } catch (error) {
    console.error('[RAZORPAY] Create Order Error:', error.message);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Payment initiation failed' 
    });
  }
};

/**
 * ─── POST /api/payment/verify ────────────────────────────────────────────────
 * Verifies the payment signature.
 * If valid, the caller (frontend) should then proceed to finalize the order.
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    console.log(`[RAZORPAY] Verifying signature for Gateway Order: ${razorpay_order_id}...`);

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;
    console.log(`[RAZORPAY] Signature Match: ${isAuthentic ? 'TRUE' : 'FALSE'}`);

    if (isAuthentic) {
      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        paymentId: razorpay_payment_id
      });
    } else {
      console.warn(`[RAZORPAY] Invalid signature detected for Order: ${razorpay_order_id}`);
      res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    console.error('[RAZORPAY] Verification Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Verification failed' });
  }
};
