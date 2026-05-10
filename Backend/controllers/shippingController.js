const Order = require('../models/Order');
const delhiveryService = require('../services/delhiveryService');

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
    
    // 3. Call Delhivery
    const result = await delhiveryService.createShipment(delhiveryData);

    if (result.success) {
      order.waybill = result.waybill;
      order.awb = result.waybill;
      order.delhiveryShipmentId = result.shipmentId;
      order.shipmentStatus = 'Manifested';
      order.trackingNumber = result.waybill;
      order.trackingUrl = result.trackingUrl || `https://www.delhivery.com/track/package/${result.waybill}`;
      order.shipmentPayload = result.rawResponse;
      order.shipmentCreatedAt = new Date();
      order.shippingProvider = 'Delhivery';
      
      order.statusHistory.push({
        status: order.orderStatus,
        updatedBy: req.admin?.name || 'Admin',
        note: `Shipment created via Delhivery. Waybill: ${result.waybill}`
      });

      await order.save();

      return res.json({
        success: true,
        message: 'Shipment created successfully',
        waybill: result.waybill
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Delhivery shipment creation failed'
      });
    }
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

    const result = await exports.syncOrderWithDelhivery(order);

    if (result.success) {
      return res.json({
        success: true,
        status: result.status,
        mappedStatus: result.mappedStatus,
        scans: result.scans,
        expectedDelivery: result.expectedDelivery
      });
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Internal logic to sync a single order with Delhivery
 */
exports.syncOrderWithDelhivery = async (order) => {
  try {
    const tracking = await delhiveryService.trackShipment(order.waybill || order.awb);
    
    if (tracking.success) {
      const mappedStatus = delhiveryService.mapStatus(tracking.status);
      
      if (mappedStatus && mappedStatus !== order.shipmentStatus) {
        const oldStatus = order.shipmentStatus;
        order.shipmentStatus = mappedStatus;
        
        // Update overall order status if appropriate
        if (mappedStatus === 'Delivered') {
          order.orderStatus = 'Delivered';
          order.paymentStatus = 'Completed';
        } else if (mappedStatus === 'In Transit' || mappedStatus === 'Out for Delivery') {
          if (['Ordered', 'Pending'].includes(order.orderStatus)) {
            order.orderStatus = 'Shipped';
          }
        } else if (mappedStatus === 'RTO' || mappedStatus === 'Returned') {
          order.orderStatus = 'Returned';
        } else if (mappedStatus === 'Cancelled') {
          order.orderStatus = 'Cancelled';
        }

        // Add to history only if status changed
        order.statusHistory.push({
          status: order.orderStatus,
          updatedBy: 'System (Delhivery Sync)',
          note: `Shipment status updated from ${oldStatus} to ${mappedStatus}. Courier Status: ${tracking.status}`
        });

        await order.save();
      }

      return {
        success: true,
        status: tracking.status,
        mappedStatus: mappedStatus,
        scans: tracking.scans,
        expectedDelivery: tracking.expectedDeliveryDate
      };
    }
    
    return { success: false, message: tracking.message || "Failed to fetch tracking" };
  } catch (err) {
    console.error(`[SYNC ERROR] Order ${order.orderNumber}:`, err.message);
    return { success: false, message: err.message };
  }
};

/**
 * @desc    Batch sync all active shipments
 * @route   POST /api/shipping/sync-all
 */
exports.syncAllActiveShipments = async (req, res) => {
  try {
    console.log('[TRACKING SYNC START]');
    
    // Find orders that are shipped but not yet delivered/cancelled/returned
    const activeOrders = await Order.find({
      waybill: { $exists: true, $ne: '' },
      shipmentStatus: { $nin: ['Delivered', 'Cancelled', 'Returned', 'RTO'] }
    }).limit(50); // Batch size for safety

    let successCount = 0;
    let failedCount = 0;

    for (const order of activeOrders) {
      const result = await exports.syncOrderWithDelhivery(order);
      if (result.success) successCount++;
      else failedCount++;
      
      // Subtle delay to avoid hitting rate limits too hard during loop
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[TRACKING SYNC COMPLETE] Success: ${successCount}, Failed: ${failedCount}`);

    if (res) {
      res.json({
        success: true,
        message: `Sync complete. Processed ${activeOrders.length} orders.`,
        details: { success: successCount, failed: failedCount }
      });
    }
  } catch (err) {
    console.error('[TRACKING SYNC CRITICAL ERROR]', err.message);
    if (res) res.status(500).json({ success: false, message: err.message });
  }
};
