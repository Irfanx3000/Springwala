const mongoose = require('mongoose');

const InventoryLogSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantSku: { type: String, default: '' },
  type: { type: String, enum: ['stock_in', 'stock_out', 'adjustment', 'return'], required: true },
  quantity: { type: Number, required: true },
  previousStock: { type: Number },
  newStock: { type: Number },
  reason: { type: String, default: '' },
  reference: { type: String, default: '' },  // order ID or PO number
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('InventoryLog', InventoryLogSchema);
