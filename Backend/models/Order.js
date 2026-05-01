const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  variant: { name: String, value: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  discountedPrice: { type: Number, default: 0 },
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
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
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
  trackingNumber: { type: String, default: '' },
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

// Note: orderNumber generation is now handled in the controller to ensure it's not null and unique before creation.

module.exports = mongoose.model('Order', OrderSchema);
