const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, required: true },
  image:    { type: String, default: '' },
  price:    { type: Number, required: true },
  discountedPrice: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1, default: 1 }, // number of packs
  batchQuantity: { type: Number, default: 1 }, // units per pack
  batchPrice: { type: Number, default: 0 },
  variant:  { name: String, value: String },
});

const CartSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [CartItemSchema],
}, { timestamps: true });

// Virtual: total item count
CartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual: subtotal (uses discountedPrice if set, else price)
CartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => {
    const effectivePrice = item.discountedPrice > 0 ? item.discountedPrice : item.price;
    return sum + effectivePrice * item.quantity;
  }, 0);
});

CartSchema.set('toJSON', { virtuals: true });
CartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', CartSchema);
