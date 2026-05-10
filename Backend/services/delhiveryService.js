const axios = require('axios');

/**
 * delhiveryService.js
 * handles all interactions with Delhivery API
 */

const TOKEN = (process.env.DELHIVERY_TOKEN || '').trim();
const BASE_URL = (process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com').trim();
const TRACKING_BASE_URL = (process.env.DELHIVERY_TRACKING_URL || 'https://www.delhivery.com/track/package').trim();

// Registered Pickup Warehouse Name (SSOT for Delhivery Shipment API)
const PICKUP_WAREHOUSE_NAME = "Springwala";

/**
 * Normalizes weight to grams with safety bounds (100g to 50000g)
 * Application SSOT: Weights are stored in grams.
 */
exports.normalizeWeightToGrams = (weight) => {
  let w = parseFloat(weight);
  if (isNaN(w) || w <= 0) w = 500; // Default 500g fallback
  
  // Safety Bounds
  if (w < 100) w = 100;
  if (w > 50000) w = 50000;
  
  return Math.round(w);
};

/**
 * Sanitizes phone numbers to 10-digit Indian mobile format
 */
const sanitizePhone = (phone) => {
  if (!phone) return "";
  const digits = phone.toString().replace(/\D/g, '');
  return digits.slice(-10);
};

const delhiveryClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Authorization': `Token ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Get shipping rate estimate from Delhivery
 * API: /api/kinko/v1/invoice/charges/.json
 */
exports.getShippingEstimate = async ({ pincode, weight, paymentMode = 'Prepaid', totalAmount = 0 }) => {
  try {
    if (!TOKEN) return null;

    const originPincode = process.env.PICKUP_PINCODE || "400083";
    const weightInGrams = exports.normalizeWeightToGrams(weight);

    const params = {
      md: paymentMode === 'COD' || paymentMode === 'Collect' ? 'S' : 'E',
      ss: 'R',
      d_pin: pincode,
      o_pin: originPincode,
      cgm: weightInGrams,
      pt: paymentMode === 'COD' || paymentMode === 'Collect' ? 'COD' : 'Prepaid',
      vcl: totalAmount
    };

    const response = await delhiveryClient.get('/api/kinko/v1/invoice/charges/.json', { params });
    const data = response.data;

    // Delhivery returns an array of possible services. If empty, pincode is unserviceable.
    if (data && Array.isArray(data) && data.length > 0 && data[0].total_amount !== undefined) {
      console.log(`[DELHIVERY RATE SUCCESS] Pincode: ${pincode}, Charge: ${data[0].total_amount}`);
      return {
        success: true,
        serviceable: true,
        deliveryCharge: parseFloat(data[0].total_amount),
        estimatedDays: data[0].expected_package_delivery_date || '3-5 days',
        courier: 'Delhivery'
      };
    }

    console.warn(`[DELHIVERY RATE] Pincode ${pincode} is UNSERVICEABLE or API returned no rates.`);
    return {
      success: true, // API call succeeded
      serviceable: false,
      message: "This pincode is currently not serviceable."
    };
  } catch (err) {
    console.error(`[DELHIVERY RATE FAILED]`, err.response?.data || err.message);
    return { success: false, message: "Could not fetch shipping rates" };
  }
};

/**
 * Create a shipment in Delhivery
 * @param {Object} orderData 
 */
exports.createShipment = async (orderData, retryCount = 0) => {
  let payload = null;
  try {
    if (!TOKEN) throw new Error("Delhivery Token is missing in .env");

    const { 
      orderNumber, 
      customerName, 
      shippingAddress, 
      items, 
      finalAmount, 
      paymentMethod,
      totalWeight 
    } = orderData;

    // 1. Pre-validation & Sanitization
    const sanitizedPhone = sanitizePhone(shippingAddress.phone);
    const weightInGrams = exports.normalizeWeightToGrams(totalWeight);
    const amount = Number(parseFloat(finalAmount || 0).toFixed(2));
    const qty = items.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

    if (!orderNumber) throw new Error("Order number is required for shipment");
    if (!shippingAddress.pincode) throw new Error("Pincode is required for shipment");
    if (sanitizedPhone.length !== 10) throw new Error(`Invalid 10-digit phone number: ${shippingAddress.phone}`);
    if (!items || items.length === 0) throw new Error("Items array is required for shipment");

    payload = {
      format: 'json',
      data: {
        pickup_location: PICKUP_WAREHOUSE_NAME, // Task 2: String name only
        shipments: [
          {
            name: customerName || shippingAddress.fullName,
            add: `${shippingAddress.addressLine1}, ${shippingAddress.addressLine2 || ''}`.trim(),
            pin: String(shippingAddress.pincode),
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: shippingAddress.country || 'India',
            phone: sanitizedPhone, // Task 4: 10 digits only
            order: orderNumber,
            payment_mode: paymentMethod === 'COD' ? 'Collect' : 'Prepaid',
            total_amount: amount, // Task 5: Numeric, 2 precision
            cod_amount: paymentMethod === 'COD' ? amount : 0,
            weight: weightInGrams, // Task 1: grams directly
            products_desc: items.map(i => i.name).join(', ').substring(0, 200),
            hsn_code: String(items[0]?.hsn || ''),
            quantity: qty // Task 3: Numeric
          }
        ]
      }
    };

    console.log(`[SHIPMENT CREATE REQUEST] Order: ${orderNumber} (Attempt ${retryCount + 1})`);
    
    const response = await delhiveryClient.post('/api/cne/json/create/', payload);
    const data = response.data;

    // Task 6: Full response logging on failure
    if (data && data.success) {
      console.log(`[SHIPMENT CREATED] Order: ${orderNumber}, Waybill: ${data.packages[0]?.waybill}`);
      return {
        success: true,
        waybill: data.packages[0]?.waybill,
        shipmentId: data.packages[0]?.client_order_number || data.packages[0]?.waybill,
        trackingUrl: `${TRACKING_BASE_URL}/${data.packages[0]?.waybill}`,
        rawResponse: data
      };
    } else {
      console.error(`[SHIPMENT REJECTED BY DELHIVERY] Order: ${orderNumber}`);
      console.error(`- Status: ${response.status}`);
      console.error(`- Payload:`, JSON.stringify(payload, null, 2));
      console.error(`- Response Body:`, JSON.stringify(data, null, 2));

      return {
        success: false,
        message: data?.rmk || "Delhivery validation failed",
        errors: data?.packages?.[0]?.remarks || []
      };
    }
  } catch (error) {
    const isTimeout = error.code === 'ECONNABORTED' || !error.response;
    
    if (isTimeout && retryCount < 1) {
      console.log(`[SHIPMENT RETRY] Retrying Order ${orderData.orderNumber} due to timeout...`);
      return exports.createShipment(orderData, retryCount + 1);
    }

    console.error(`[SHIPMENT API ERROR] Order: ${orderData.orderNumber}`);
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Data:`, JSON.stringify(error.response.data, null, 2));
      if (payload) console.error(`- Payload Sent:`, JSON.stringify(payload, null, 2));
    } else {
      console.error(`- Message: ${error.message}`);
    }

    return {
      success: false,
      message: error.response?.data?.rmk || error.message,
      isNetworkError: !error.response
    };
  }
};

/**
 * Track shipment by waybill
 * @param {string} waybill 
 */
exports.trackShipment = async (waybill) => {
  try {
    if (!TOKEN) throw new Error("Delhivery Token is missing in .env");

    // API: GET /api/v1/packages/json/?waybill=<waybill>
    const response = await delhiveryClient.get(`/api/v1/packages/json/?waybill=${waybill}`);
    
    const data = response.data;
    if (data && data.ShipmentData && data.ShipmentData.length > 0) {
      const shipment = data.ShipmentData[0].Shipment;
      return {
        success: true,
        status: shipment.Status.Status,
        scans: shipment.Scans,
        expectedDeliveryDate: shipment.ExpectedDeliveryDate,
        raw: shipment
      };
    }
    
    return { success: false, message: "No tracking data found" };
  } catch (error) {
    console.error(`[DELHIVERY] Track Error:`, error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Cancel shipment
 * @param {string} waybill 
 */
exports.cancelShipment = async (waybill) => {
  try {
    const payload = {
      waybill: waybill,
      cancellation: true
    };
    
    const response = await delhiveryClient.post('/api/p/edit/', payload);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`[DELHIVERY] Cancel Error:`, error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Map Delhivery status to internal Order status
 * @param {string} delhiveryStatus 
 */
exports.mapStatus = (delhiveryStatus) => {
  if (!delhiveryStatus) return null;
  const status = delhiveryStatus.toLowerCase();
  
  if (status.includes('manifest') || status.includes('ready')) return 'Manifested';
  if (status.includes('transit') || status.includes('dispatched') || status.includes('shipped') || status.includes('in-transit')) return 'In Transit';
  if (status.includes('delivered') || status.includes('dl')) return 'Delivered';
  if (status.includes('out for delivery') || status.includes('ofd')) return 'Out for Delivery';
  if (status.includes('rto') || status.includes('return to origin') || status.includes('returning')) return 'RTO';
  if (status.includes('cancelled') || status.includes('cnl')) return 'Cancelled';
  if (status.includes('returned')) return 'Returned';
  
  return null; 
};
