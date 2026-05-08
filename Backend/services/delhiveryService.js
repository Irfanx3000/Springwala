const axios = require('axios');

/**
 * delhiveryService.js
 * handles all interactions with Delhivery API
 */

const TOKEN = (process.env.DELHIVERY_TOKEN || '').trim();
const BASE_URL = (process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com').trim();

// Pickup location details (Business defaults)
const PICKUP_LOCATION = {
  name: "New India Industrial Spring MFG.",
  add: "C 5, Shiv Bhole Laghu Udyog Nagar, Ambewadi, Near Vitrum Glass Factory, LBS Marg, Vikhroli West, Mumbai - 400083",
  city: "Mumbai",
  pin: "400083",
  phone: "8080192827",
  email: "newindiaspring@yahoo.com",
  gstin: "27AABPH9303E1Z3"
};

/**
 * Normalizes any weight input to grams for Delhivery
 */
exports.normalizeWeightToGrams = (weight, unit = 'kg') => {
  let w = parseFloat(weight) || 0.5; // Default 500g
  const u = (unit || 'kg').toLowerCase();

  if (u === 'kg') return w * 1000;
  if (u === 'g' || u === 'grams') return w;
  
  return w * 1000; // Assume kg if unknown
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

    const params = {
      md: paymentMode === 'COD' || paymentMode === 'Collect' ? 'S' : 'E', // S for Surface/COD usually, E for Express
      ss: 'R', // R for Reverse if needed, but usually forward
      d_pin: pincode,
      o_pin: PICKUP_LOCATION.pin,
      cgm: weight || 500, // in grams
      pt: paymentMode === 'COD' || paymentMode === 'Collect' ? 'COD' : 'Prepaid',
      vcl: totalAmount
    };

    const response = await delhiveryClient.get('/api/kinko/v1/invoice/charges/.json', { params });
    const data = response.data;

    if (data && data[0]) {
      console.log(`[DELHIVERY RATE SUCCESS] Pincode: ${pincode}, Charge: ${data[0].total_amount}`);
      return {
        success: true,
        serviceable: true,
        deliveryCharge: parseFloat(data[0].total_amount),
        estimatedDays: data[0].expected_package_delivery_date || '3-5 days',
        courier: 'Delhivery'
      };
    }

    return null;
  } catch (err) {
    console.error(`[DELHIVERY RATE FAILED]`, err.message);
    return null;
  }
};

/**
 * Create a shipment in Delhivery
 * @param {Object} orderData 
 */
exports.createShipment = async (orderData, retryCount = 0) => {
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

    // Weight Normalization
    const weightInGrams = exports.normalizeWeightToGrams(totalWeight, 'kg');

    const payload = {
      format: 'json',
      data: {
        pickup_location: {
          name: PICKUP_LOCATION.name,
          add: PICKUP_LOCATION.add,
          city: PICKUP_LOCATION.city,
          pin: PICKUP_LOCATION.pin,
          phone: PICKUP_LOCATION.phone
        },
        shipments: [
          {
            name: customerName || shippingAddress.fullName,
            add: `${shippingAddress.addressLine1}, ${shippingAddress.addressLine2 || ''}`.trim(),
            pin: shippingAddress.pincode,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: shippingAddress.country || 'India',
            phone: shippingAddress.phone,
            order: orderNumber,
            payment_mode: paymentMethod === 'COD' ? 'Collect' : 'Prepaid',
            total_amount: finalAmount,
            cod_amount: paymentMethod === 'COD' ? finalAmount : 0,
            weight: weightInGrams,
            products_desc: items.map(i => i.name).join(', ').substring(0, 200),
            hsn_code: items[0]?.hsn || '',
            quantity: items.reduce((acc, i) => acc + i.quantity, 0).toString()
          }
        ]
      }
    };

    console.log(`[SHIPMENT CREATE REQUEST] Order: ${orderNumber} (Attempt ${retryCount + 1})...`);
    console.log(`[DELHIVERY PAYLOAD]`, JSON.stringify(payload, null, 2));
    
    const response = await delhiveryClient.post('/api/cne/json/create/', payload);
    const data = response.data;

    if (data && data.success) {
      console.log(`[SHIPMENT CREATED] Order: ${orderNumber}, Waybill: ${data.packages[0]?.waybill}`);
      return {
        success: true,
        waybill: data.packages[0]?.waybill,
        shipmentId: data.packages[0]?.client_order_number || data.packages[0]?.waybill,
        rawResponse: data
      };
    } else {
      console.error(`[SHIPMENT FAILED] API Error for ${orderNumber}:`, JSON.stringify(data, null, 2));
      return {
        success: false,
        message: data?.rmk || "Unknown Delhivery error",
        errors: data?.packages[0]?.remarks || []
      };
    }
  } catch (error) {
    const isTimeout = error.code === 'ECONNABORTED' || !error.response;
    
    if (isTimeout && retryCount < 1) {
      console.log(`[SHIPMENT RETRY] Retrying Order ${orderData.orderNumber} due to timeout...`);
      return exports.createShipment(orderData, retryCount + 1);
    }

    console.error(`[SHIPMENT FAILED] Connection Error for ${orderData.orderNumber}:`, error.message);
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
