const PartnerApplication = require('../models/PartnerApplication');
const Inquiry = require('../models/Inquiry');

// Helper to sanitize input and prevent basic XSS
const sanitize = (val) => {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').trim();
};

/**
 * Submit Partner/Vendor Application (Public)
 */
exports.submitPartnerApplication = async (req, res) => {
  try {
    let { fullName, email, phone, businessName, gstNumber, productCategory } = req.body;

    if (!fullName || !email || !phone || !businessName || !productCategory) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }

    // Sanitize
    fullName = sanitize(fullName);
    email = sanitize(email).toLowerCase();
    phone = sanitize(phone).replace(/\s+/g, '');
    businessName = sanitize(businessName);
    gstNumber = gstNumber ? sanitize(gstNumber) : '';
    productCategory = sanitize(productCategory);

    // Validation checks
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
    }

    // Create Application
    const application = await PartnerApplication.create({
      fullName,
      email,
      phone,
      businessName,
      gstNumber,
      productCategory,
      status: 'New'
    });

    // Create Inquiry Entry (Notification)
    await Inquiry.create({
      fullName,
      email,
      phoneNumber: phone,
      subject: 'New Partner Application Received',
      message: `Business Name: ${businessName}\nGST Number: ${gstNumber || 'N/A'}\nProduct Category: ${productCategory.replace(/-/g, ' ').toUpperCase()}`,
      status: 'Unread'
    });

    return res.status(201).json({
      success: true,
      message: 'Your application has been successfully submitted! We will contact you shortly.',
      application
    });

  } catch (err) {
    console.error('[Partner Submit Controller Error]', err);
    return res.status(500).json({ success: false, message: 'Server error saving vendor application. Please try again.' });
  }
};

/**
 * Get Paginated Partner Applications (Admin)
 */
exports.getPartnerApplications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const { status, productCategory } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (productCategory) query.productCategory = productCategory;

    const total = await PartnerApplication.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const applications = await PartnerApplication.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      applications,
      page,
      pages,
      total
    });

  } catch (err) {
    console.error('[Get Partner Applications Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving partner applications.' });
  }
};

/**
 * Get Single Partner Application Details (Admin)
 */
exports.getPartnerApplication = async (req, res) => {
  try {
    const application = await PartnerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Partner application not found.' });
    }
    return res.json({ success: true, application });
  } catch (err) {
    console.error('[Get Partner Application Details Error]', err);
    return res.status(500).json({ success: false, message: 'Server error loading application details.' });
  }
};

/**
 * Update Partner Application Status (Admin)
 */
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['New', 'Contacted', 'Under Review', 'Approved', 'Rejected'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status.' });
    }

    const application = await PartnerApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Partner application not found.' });
    }

    return res.json({ success: true, message: 'Partner application status updated successfully.', application });
  } catch (err) {
    console.error('[Update Partner Status Error]', err);
    return res.status(500).json({ success: false, message: 'Server error updating status.' });
  }
};
