const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const SiteSettings = require('../models/SiteSettings');

/**
 * Helper to fetch site settings singleton
 */
async function getSettings() {
  try {
    const settings = await SiteSettings.findOne({ _singleton: 'global' });
    return settings || { 
      siteName: 'Springwala', 
      contactEmail: 'support@springwala.com', 
      contactNumber: '+91 8879 241085', 
      address: 'Shop No. 5, Near Station, Mumbai 400083' 
    };
  } catch (e) {
    return { siteName: 'Springwala' };
  }
}

/**
 * Generates a PDF invoice for an order.
 * @param {Object} order - The order document from MongoDB.
 * @returns {Promise<string>} - Absolute path to the generated PDF.
 */
const generateInvoice = async (order) => {
  const settings = await getSettings();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const invoiceName = `${order.orderNumber}.pdf`;
      const invoicesDir = path.join(__dirname, '..', 'uploads', 'invoices');

      // Ensure directory exists
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filePath = path.join(invoicesDir, invoiceName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // --- Header ---
      doc.fillColor('#BE2229') // Corporate color
         .fontSize(22)
         .font('Helvetica-Bold')
         .text((settings.siteName || 'SPRINGWALA').toUpperCase(), 50, 57)
         .fontSize(10)
         .fillColor('#444444')
         .font('Helvetica')
         .text('TAX INVOICE', 200, 65, { align: 'right' })
         .moveDown();

      // Seller Details
      doc.fontSize(8)
         .text(settings.address || '', 50, 80, { width: 250 })
         .text(`Email: ${settings.contactEmail || ''} | Phone: ${settings.contactNumber || ''}`, 50, 92);
      
      doc.moveTo(50, 105).lineTo(560, 105).stroke();

      doc.fillColor('#444444')
         .fontSize(10)
         .text(`Order ID: ${order.orderNumber}`, 350, 120, { align: 'right' })
         .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 135, { align: 'right' })
         .text(`Status: ${order.orderStatus}`, 350, 150, { align: 'right' });

      if (order.courier || order.waybill) {
        doc.text(`Courier: ${order.courier || 'Delhivery'}`, 50, 145);
        if (order.waybill) doc.text(`Tracking ID: ${order.waybill}`, 50, 160);
        doc.moveDown();
      } else {
        doc.moveDown();
      }

      // --- Shipping Address ---
      const sa = order.shippingAddress;
      const billToY = (order.courier || order.waybill) ? 190 : 160;
      doc.text('Bill To:', 50, billToY, { fontWeight: 'bold' })
         .text(sa.fullName, 50, billToY + 15)
         .text(sa.addressLine1, 50, billToY + 30)
         .text(`${sa.city}, ${sa.state} - ${sa.pincode}`, 50, billToY + 45)
         .text(`Phone: ${sa.phone}`, 50, billToY + 60)
         .moveDown();

      // --- Items Table ---
      let tableTop = 260;
      doc.font('Helvetica-Bold');
      doc.text('Item', 50, tableTop);
      doc.text('Quantity', 280, tableTop, { width: 90, align: 'right' });
      doc.text('Price', 370, tableTop, { width: 90, align: 'right' });
      doc.text('Total', 480, tableTop, { width: 70, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();
      doc.font('Helvetica');

      const safe = (val) => Number(val || 0).toFixed(2);

      let i = 0;
      order.items.forEach(item => {
        const y = tableTop + 25 + (i * 25);
        
        // Use SSOT snapshot fields
        const isBatch = item.isBatchProduct && item.batchQuantity > 0;
        const itemName = isBatch ? `${item.name} (Pack of ${item.batchQuantity})` : item.name;
        const price = isBatch ? item.batchPrice : item.unitPrice;
        const quantity = item.quantity || 1; // Number of packs or units
        const subtotal = item.subtotal || (price * quantity);

        doc.text(itemName, 50, y, { width: 200 });
        doc.text(quantity.toString(), 280, y, { width: 90, align: 'right' });
        doc.text(`₹${safe(price)}`, 370, y, { width: 90, align: 'right' });
        doc.text(`₹${safe(subtotal)}`, 480, y, { width: 70, align: 'right' });
        i++;
      });

      const subtotalY = tableTop + 35 + (i * 25);
      doc.moveTo(50, subtotalY).lineTo(560, subtotalY).stroke();

      // --- Financials (ORDER-SYNC: Use Persisted Snapshots) ---
      const finalY = subtotalY + 20;
      doc.text('Subtotal:', 380, finalY, { width: 100, align: 'right' });
      doc.text(`₹${safe(order.subtotal)}`, 480, finalY, { width: 70, align: 'right' });

      doc.text('GST Amount:', 380, finalY + 15, { width: 100, align: 'right' });
      doc.text(`₹${safe(order.gstAmount)}`, 480, finalY + 15, { width: 70, align: 'right' });

      doc.text('Shipping:', 380, finalY + 30, { width: 100, align: 'right' });
      const shipping = order.shippingCharge || order.deliveryCharges || 0;
      doc.text(shipping === 0 ? 'FREE' : `₹${safe(shipping)}`, 480, finalY + 30, { width: 70, align: 'right' });

      doc.font('Helvetica-Bold')
         .text('Grand Total:', 380, finalY + 50, { width: 100, align: 'right' })
         .text(`₹${safe(order.totalAmount || order.finalAmount)}`, 480, finalY + 50, { width: 70, align: 'right' });

      console.log(`[ORDER-SYNC] Invoice Generated: Order=${order.orderNumber}, Total=${order.totalAmount}`);

      // --- Footer ---
      doc.font('Helvetica')
         .fontSize(9)
         .text(`Thank you for shopping with ${settings.siteName || 'Springwala'}!`, 50, 720, { align: 'center', width: 500 })
         .fontSize(8)
         .fillColor('#999999')
         .text('This is a computer generated invoice and does not require a physical signature.', 50, 735, { align: 'center', width: 500 });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoice;
