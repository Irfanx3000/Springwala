const Order = require('../models/Order');
// const delhiveryService = require('../services/delhiveryService');

/**
 * @desc    Manual retry or initial shipment creation for an order
 * @route   POST /api/shipping/create/:orderId
 */
exports.createOrderShipment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 1. Strict Validation
    if (order.waybill || order.awb || order.trackingNumber) {
      return res.status(400).json({ success: false, message: 'Shipment already exists for this order.' });
    }

    if (order.paymentMethod !== 'Online' || order.paymentStatus !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Shipment can ONLY be created for completed Online payments.' });
    }

    // 2. Validate essential data
    if (!order.shippingAddress || !order.shippingAddress.pincode || !order.shippingAddress.phone) {
      return res.status(400).json({ success: false, message: 'Shipping address, pincode, and phone number are required.' });
    }

    // 2. Prepare Data
    // Calculate weight from items
    let totalWeight = 0;
    for (const item of order.items) {
      const weight = item.product?.weight || 0.5;
      totalWeight += weight * item.quantity;
    }

    const delhiveryData = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      items: order.items,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      totalWeight: totalWeight
    };

    console.log(`[SHIPMENT CREATE REQUEST] Order: ${order.orderNumber}`);
    
    // ─── TEMPORARY MANUAL SHIPPING MODE ───
    /* ─── COMMENTED OUT: LIVE DELHIVERY SHIPMENT CREATION ───
    const result = await delhiveryService.createShipment(delhiveryData);
    if (result.success) { ... }
    */

    // Manual Logic: Just mark as Shipped and add tracking number manually if provided
    order.shipmentStatus = 'Manual';
    order.shippingProvider = 'Manual';
    order.orderStatus = 'Shipped';
    order.trackingNumber = `MANUAL-${order.orderNumber}`;
    order.trackingUrl = '#'; // Manual tracking via status updates
    order.shipmentCreatedAt = new Date();
    
    order.statusHistory.push({
      status: 'Shipped',
      updatedBy: req.admin?.name || 'Admin',
      note: 'Shipment marked as Shipped (Manual Fulfillment Mode).'
    });

    await order.save();

    return res.json({
      success: true,
      message: 'Order marked as Shipped (Manual Mode)',
      trackingNumber: order.trackingNumber
    });
  } catch (err) {
    console.error('[SHIPPING CONTROLLER ERROR]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Fetch live tracking status and sync order
 * @route   GET /api/shipping/track/:waybill
 */
exports.trackAndSyncShipment = async (req, res) => {
  try {
    const { waybill } = req.params;
    const order = await Order.findOne({ waybill });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found for this waybill.' });
    }

    // ─── TEMPORARILY DISABLED: MANUAL MODE ───
    return res.json({
      success: true,
      status: order.orderStatus,
      message: "Manual fulfillment: tracking is based on internal order status updates."
    });
    /*
    const result = await exports.syncOrderWithDelhivery(order);
    ...
    */
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Internal logic to sync a single order with Delhivery
 */
exports.syncOrderWithDelhivery = async (order) => {
  // ─── TEMPORARILY DISABLED: MANUAL MODE ───
  return { success: true, message: "Manual mode active" };
  /*
  try {
    const tracking = await delhiveryService.trackShipment(order.waybill || order.awb);
    ...
  }
  */
};

/**
 * @desc    Batch sync all active shipments
 * @route   POST /api/shipping/sync-all
 */
exports.syncAllActiveShipments = async (req, res) => {
  // ─── TEMPORARILY DISABLED: MANUAL MODE ───
  if (res) res.json({ success: true, message: "Sync skipped (Manual Mode Active)" });
};
