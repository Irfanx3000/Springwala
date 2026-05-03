const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:       { type: String, required: true },
  image:      { type: String, default: '' },
  finalPrice: { type: Number, required: true }, // Final Price per unit/pack incl. GST
  quantity:   { type: Number, required: true, min: 1, default: 1 }, 
  batchQuantity: { type: Number, default: 1 }, 
  variant:    { name: String, value: String },
});

const CartSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [CartItemSchema],
}, { timestamps: true });

// Virtual: total item count
CartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual: subtotal (Single Source of Truth)
CartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => {
    return sum + (item.finalPrice * item.quantity);
  }, 0);
});

CartSchema.set('toJSON', { virtuals: true });
CartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', CartSchema);
