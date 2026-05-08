const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  variant: { name: String, value: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number },
  subtotal: { type: Number },
  finalPrice: { type: Number, required: true }, // The finalPrice (incl. GST) at time of order
  total: { type: Number, required: true },        // finalPrice * quantity
  hsn: { type: String, default: '' },
  
  // Unified Pricing Snapshots
  isBatchProduct: { type: Boolean, default: false },
  batchQuantity: { type: Number },
  batchPrice: { type: Number },
  unitPrice: { type: Number }, // Effective unit price (either unit finalPrice or perUnitFromBatch)
  discountAmount: { type: Number },
  gstAmount: { type: Number },
  basePrice: { type: Number },
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String },
  invoiceUrl: { type: String },
  items: { type: [OrderItemSchema], required: true },
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India', required: true },
  },
  subtotal: { type: Number, required: true },
  gstAmount: { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  deliveryCharges: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  finalAmount: { type: Number },
  totalUnits: { type: Number },
  totalWeight: { type: Number },

  orderStatus: {
    type: String,
    enum: ['Pending', 'Ordered', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Ordered'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  paymentMethod: { type: String, required: true, enum: ['COD', 'Online', 'UPI', 'Card', 'Wallet'], default: 'COD' },
  paymentDetails: { transactionId: String, gateway: String, paidAt: Date },
  
  // Shipping details
  shippingProvider: { type: String, default: 'Delhivery' },
  trackingNumber: { type: String, default: '' },
  awb: { type: String, default: '' },
  waybill: { type: String, default: '' }, // Delhivery waybill
  trackingUrl: { type: String, default: '' },
  delhiveryShipmentId: { type: String, default: '' },
  shipmentStatus: {
    type: String,
    enum: ['Pending', 'Ready to Ship', 'Manifested', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'RTO'],
    default: 'Pending'
  },
  shipmentCreatedAt: { type: Date },
  shipmentPayload: { type: Object }, // Store the exact payload sent to Delhivery
  
  courier: { type: String, default: '' },
  notes: { type: String, default: '' },
  cancelReason: { type: String, default: '' },
  statusHistory: [{
    status: String,
    updatedAt: { type: Date, default: Date.now },
    updatedBy: String,
    note: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
