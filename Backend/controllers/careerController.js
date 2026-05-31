const CareerApplication = require('../models/CareerApplication');
const Inquiry = require('../models/Inquiry');

// Helper to sanitize input and prevent basic XSS
const sanitize = (val) => {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').trim();
};

/**
 * Submit Job Application (Public)
 */
exports.submitApplication = async (req, res) => {
  try {
    let { fullName, email, phone, position, experience, location, coverLetter } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume file upload is required.' });
    }

    if (!fullName || !email || !phone || !position || !experience || !location || !coverLetter) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Sanitize
    fullName = sanitize(fullName);
    email = sanitize(email).toLowerCase();
    phone = sanitize(phone).replace(/\s+/g, '');
    position = sanitize(position);
    experience = sanitize(experience);
    location = sanitize(location);
    coverLetter = sanitize(coverLetter);

    // Validation checks
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
    }

    const resumeUrl = 'uploads/resumes/' + req.file.filename;
    const resumeFileName = req.file.originalname;

    const application = await CareerApplication.create({
      fullName,
      email,
      phone,
      position,
      experience,
      location,
      resumeUrl,
      resumeFileName,
      coverLetter,
      status: 'New'
    });

    // Create Inquiry Entry (Notification)
    await Inquiry.create({
      fullName,
      email,
      phoneNumber: phone,
      subject: 'New Career Application Received',
      message: `Position: ${position}\nExperience: ${experience}\nLocation: ${location}\nCover Letter: ${coverLetter}\nResume: ${resumeFileName}`,
      status: 'Unread'
    });

    return res.status(201).json({
      success: true,
      message: 'Your application has been submitted successfully!',
      application
    });

  } catch (err) {
    console.error('[Career Submit Controller Error]', err);
    return res.status(500).json({ success: false, message: 'Server error saving application.' });
  }
};

/**
 * Get Paginated Career Applications (Admin)
 */
exports.getApplications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const { status, position, experience } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (position) query.position = position;
    if (experience) query.experience = experience;

    const total = await CareerApplication.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const applications = await CareerApplication.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      applications,
      page,
      pages,
      total
    });

  } catch (err) {
    console.error('[Get Career Applications Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving applications.' });
  }
};

/**
 * Get Single Career Application Details (Admin)
 */
exports.getApplication = async (req, res) => {
  try {
    const application = await CareerApplication.findById(req.params.id).lean();
    if (!application) {
      return res.status(404).json({ success: false, message: 'Career application not found.' });
    }
    return res.json({ success: true, application });
  } catch (err) {
    console.error('[Get Career Application Error]', err);
    return res.status(500).json({ success: false, message: 'Server error loading details.' });
  }
};

/**
 * Update Application Status (Admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['New', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status.' });
    }

    const application = await CareerApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Career application not found.' });
    }

    return res.json({ success: true, message: 'Status updated successfully.', application });
  } catch (err) {
    console.error('[Update Career Status Error]', err);
    return res.status(500).json({ success: false, message: 'Server error updating status.' });
  }
};

/**
 * Delete Career Application (Admin)
 */
exports.deleteApplication = async (req, res) => {
  try {
    const application = await CareerApplication.findByIdAndDelete(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Career application not found.' });
    }
    return res.json({ success: true, message: 'Career application removed successfully.' });
  } catch (err) {
    console.error('[Delete Career Application Error]', err);
    return res.status(500).json({ success: false, message: 'Server error removing application.' });
  }
};
