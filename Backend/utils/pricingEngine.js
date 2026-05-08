/**
 * UNIFIED PRICING ENGINE (BACKEND)
 * Single source of truth for all pricing calculations.
 */

const PricingEngine = {
  /**
   * Validates if a batch object is well-formed.
   */
  validateBatch(batch) {
    if (!batch) return false;
    const hasValidStructure = 
      batch && 
      (typeof batch.quantity === 'number' || !isNaN(Number(batch.quantity))) && 
      (typeof batch.price === 'number' || !isNaN(Number(batch.price)));
    
    if (!hasValidStructure) return false;
    return Number(batch.quantity) > 0;
  },

  /**
   * Attempts to find the first valid batch for a product.
   */
  autoRecoverBatch(product) {
    if (product && Array.isArray(product.batches) && product.batches.length > 0) {
      return product.batches.find(b => this.validateBatch(b)) || null;
    }
    return null;
  },

  /**
   * Calculates unit pricing details for a product.
   * @param {Object} product - Product document or object with basePrice, discountPercent, gstPercent.
   * @returns {Object} { baseUnitPrice, discountPercent, gstPercent, discountedUnitPrice, finalUnitPrice }
   */
  calculateUnitPricing(product) {
    const baseUnitPrice = Number(product.basePrice || product.price || 0);
    const discountPercent = Number(product.discountPercent || 0);
    const gstPercent = Number(product.gstPercent || 0);

    // discountedUnitPrice = WITHOUT GST
    const discountedUnitPrice = baseUnitPrice * (1 - discountPercent / 100);
    
    // finalUnitPrice = INCLUDING GST
    const finalUnitPrice = discountedUnitPrice * (1 + gstPercent / 100);

    return {
      baseUnitPrice: Number(baseUnitPrice.toFixed(2)),
      discountPercent: Number(discountPercent.toFixed(2)),
      gstPercent: Number(gstPercent.toFixed(2)),
      discountedUnitPrice: Number(discountedUnitPrice.toFixed(2)),
      finalUnitPrice: Number(finalUnitPrice.toFixed(2))
    };
  },

  /**
   * Calculates batch pricing details.
   * @param {Object} product - Product object (for fallback or metadata).
   * @param {Object} selectedBatch - The batch object { quantity, price }.
   * @returns {Object} { batchQuantity, batchPrice, perUnitFromBatch }
   */
  calculateBatchPricing(product, selectedBatch) {
    if (!this.validateBatch(selectedBatch)) {
      console.warn(`[PRICING ENGINE] Invalid batch for ${product?.name || 'Unknown'}:`, selectedBatch);
      return null;
    }

    const batchQuantity = Number(selectedBatch.quantity);
    const batchPrice = Number(selectedBatch.price);
    const perUnitFromBatch = batchQuantity > 0 ? batchPrice / batchQuantity : 0;


    return {
      batchQuantity,
      batchPrice: Number(batchPrice.toFixed(2)),
      perUnitFromBatch: Number(perUnitFromBatch.toFixed(2))
    };
  },

  /**
   * Universal cart/order item calculator.
   * @param {Object} item - Item with product data and quantity.
   * @returns {Object} Calculated totals and metadata.
   */
  calculateCartItem(item) {
    if (!item) return this._fallbackToNormalPricing({}, 1);
    const product = item.product || item;
    if (!product) return this._fallbackToNormalPricing({}, 1);

    const quantity = Number(item.quantity || 1);
    
    let selectedBatch = item.selectedBatch;

    // 1. LEGACY/MALFORMED RECOVERY
    if (!selectedBatch && product.batches && product.batches.length > 0) {
      selectedBatch = this.autoRecoverBatch(product);
      if (selectedBatch) {
        console.log(`[PRICING RECOVERY] Auto-assigned first batch for "${product.name}" (Pack of ${selectedBatch.quantity})`);
      }
    }

    // 2. DEFENSIVE VALIDATION
    const hasValidBatch = this.validateBatch(selectedBatch);
    const isBatchProduct = hasValidBatch;

    let subtotal = 0;
    let totalUnits = 0;
    let displayPrice = 0;
    let unitPrice = 0;
    let batchPrice = 0;
    let batchQuantity = 0;

    if (isBatchProduct) {
      const batchPricing = this.calculateBatchPricing(product, selectedBatch);
      if (batchPricing) {
        batchPrice = batchPricing.batchPrice;
        batchQuantity = batchPricing.batchQuantity;
        subtotal = batchPrice * quantity;
        totalUnits = batchQuantity * quantity;
        displayPrice = batchPrice;
        unitPrice = batchPricing.perUnitFromBatch;
        console.log(`[PRICING CALC] BATCH: ${product.name} | Qty: ${quantity} | Pack: ${batchQuantity} | Subtotal: ${subtotal}`);
      } else {
        return this._fallbackToNormalPricing(product, quantity);
      }
    } else {
      const unitPricing = this.calculateUnitPricing(product);
      unitPrice = unitPricing.finalUnitPrice;
      subtotal = unitPrice * quantity;
      totalUnits = quantity;
      displayPrice = unitPrice;
      console.log(`[PRICING CALC] UNIT: ${product.name} | Qty: ${quantity} | Subtotal: ${subtotal}`);
    }

    const unitWeight = Number(product.weight || 0);
    const deliveryEligibleWeight = totalUnits * unitWeight;

    // Detailed Breakdown
    const unitPricing = this.calculateUnitPricing(product);
    const totalWithoutGst = (isBatchProduct ? batchPrice : unitPricing.discountedUnitPrice) * quantity;
    const gstAmount = subtotal - totalWithoutGst;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalUnits,
      displayPrice: Number(displayPrice.toFixed(2)),
      deliveryEligibleWeight,
      unitPrice: Number(unitPrice.toFixed(2)),
      batchPrice: Number(batchPrice.toFixed(2)),
      batchQuantity: isBatchProduct ? batchQuantity : 1,
      isBatchProduct,
      hsn: product.hsnCode || product.hsn || '',
      selectedBatch: isBatchProduct ? selectedBatch : null,
      
      // Tax & Discount Breakdown
      baseUnitPrice: unitPricing.baseUnitPrice,
      discountPercent: unitPricing.discountPercent,
      gstPercent: unitPricing.gstPercent,
      totalWithoutGst: Number(totalWithoutGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2))
    };
  },

  _fallbackToNormalPricing(product, quantity) {
    const p = product || {};
    const unitPricing = this.calculateUnitPricing(p);
    const unitPrice = unitPricing.finalUnitPrice;
    return {
      subtotal: Number((unitPrice * quantity).toFixed(2)),
      totalUnits: quantity,
      displayPrice: unitPrice,
      deliveryEligibleWeight: quantity * Number(p.weight || 0),
      unitPrice: unitPrice,
      batchPrice: 0,
      batchQuantity: 1,
      isBatchProduct: false,
      hsn: p.hsnCode || p.hsn || '',
      selectedBatch: null,
      
      // Tax Breakdown
      baseUnitPrice: unitPricing.baseUnitPrice,
      discountPercent: unitPricing.discountPercent,
      gstPercent: unitPricing.gstPercent,
      totalWithoutGst: Number((unitPricing.discountedUnitPrice * quantity).toFixed(2)),
      gstAmount: Number(((unitPrice - unitPricing.discountedUnitPrice) * quantity).toFixed(2))
    };
  },


  /**
   * Calculates grand totals for a list of cart items.
   * @param {Array} items - Array of items.
   * @param {Number} deliveryCharge - Actual delivery charge calculated externally.
   * @returns {Object}
   */
  calculateOrderTotals(items, deliveryCharge = 0) {
    let subtotal = 0;
    let totalUnits = 0;
    let totalWeight = 0;

    const calculatedItems = items.map(item => {
      const calc = this.calculateCartItem(item);
      subtotal += calc.subtotal;
      totalUnits += calc.totalUnits;
      totalWeight += calc.deliveryEligibleWeight;
      return { ...item, ...calc };
    });

    console.log('[PRICING ENGINE] Order Totals:', {
      itemsCount: calculatedItems.length,
      subtotal,
      totalWeight,
      totalAmount: subtotal + deliveryCharge
    });

    return {
      items: calculatedItems,
      subtotal: Number(subtotal.toFixed(2)),
      totalUnits,
      totalWeight,
      deliveryCharge: Number(deliveryCharge.toFixed(2)),
      totalAmount: Number((subtotal + deliveryCharge).toFixed(2))
    };
  }
};

module.exports = PricingEngine;
