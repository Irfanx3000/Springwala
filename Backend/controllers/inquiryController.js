const Inquiry = require('../models/Inquiry');
const Newsletter = require('../models/Newsletter');
const CareerApplication = require('../models/CareerApplication');
const PartnerApplication = require('../models/PartnerApplication');
const ComingSoonNotification = require('../models/ComingSoonNotification');

// Helper to sanitize input and prevent basic XSS
const sanitize = (val) => {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').trim();
};

// ── USER-FACING ENDPOINTS ──────────────────────────────────────────────────────

/**
 * Submit Contact Us Message
 */
exports.submitInquiry = async (req, res) => {
  try {
    let { fullName, email, phoneNumber, subject, message } = req.body;

    // 1. Basic validation
    if (!fullName || !email || !phoneNumber || !subject || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Sanitize values
    fullName = sanitize(fullName);
    email = sanitize(email).toLowerCase();
    phoneNumber = sanitize(phoneNumber);
    subject = sanitize(subject);
    message = sanitize(message);

    // 2. Strict format checks
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });
    }

    if (fullName.length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }

    if (subject.length < 3) {
      return res.status(400).json({ success: false, message: 'Subject is too short.' });
    }

    if (message.length < 5) {
      return res.status(400).json({ success: false, message: 'Message is too short.' });
    }

    // 3. Save Inquiry
    const inquiry = await Inquiry.create({
      fullName,
      email,
      phoneNumber,
      subject,
      message,
      status: 'Unread'
    });

    return res.status(201).json({
      success: true,
      message: 'Your message has been successfully submitted. We will get back to you soon.',
      inquiry
    });

  } catch (err) {
    console.error('[Inquiry Controller Error]', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/**
 * Submit Newsletter Email
 */
exports.subscribeNewsletter = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please enter your email address.' });
    }

    email = sanitize(email).toLowerCase();
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Check if already exists
    let subscriber = await Newsletter.findOne({ email });
    if (subscriber) {
      if (subscriber.status === 'Subscribed') {
        return res.status(400).json({ success: false, message: 'This email is already subscribed to our newsletter.' });
      } else {
        subscriber.status = 'Subscribed';
        subscriber.subscribedAt = Date.now();
        await subscriber.save();
      }
    } else {
      subscriber = await Newsletter.create({ email, status: 'Subscribed' });
    }

    return res.json({
      success: true,
      message: 'You have subscribed to our newsletter successfully!',
      subscriber
    });

  } catch (err) {
    console.error('[Newsletter Controller Error]', err);
    return res.status(500).json({ success: false, message: 'Unable to connect to the server. Please try again later.' });
  }
};

/**
 * Submit Coming Soon Notification Lead
 */
exports.submitComingSoonNotification = async (req, res) => {
  try {
    let { email, sourcePage } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please enter your email address.' });
    }

    email = sanitize(email).toLowerCase();
    sourcePage = sanitize(sourcePage) || 'coming-soon.html';

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    let notification = await ComingSoonNotification.findOne({ email, sourcePage });
    if (notification) {
      notification.status = 'New';
      await notification.save();
    } else {
      notification = await ComingSoonNotification.create({ email, sourcePage, status: 'New' });
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you! You will be notified when this page goes live.',
      notification
    });
  } catch (err) {
    console.error('[Coming Soon Notification Error]', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email is already on the notification list.' });
    }
    return res.status(500).json({ success: false, message: 'Unable to save your notification request.' });
  }
};


// ── ADMIN PANEL ENDPOINTS ──────────────────────────────────────────────────────

/**
 * Get Inquiries with Pagination and Search
 */
exports.getInquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Inquiry.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const inquiries = await Inquiry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      inquiries,
      page,
      pages,
      total
    });

  } catch (err) {
    console.error('[Admin Inquiries Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving inquiries.' });
  }
};

/**
 * Get Single Inquiry Details
 */
exports.getInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }
    return res.json({ success: true, inquiry });
  } catch (err) {
    console.error('[Admin Inquiry Detail Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving inquiry details.' });
  }
};

/**
 * Mark Inquiry as Read
 */
exports.markInquiryRead = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    inquiry.status = 'Read';
    await inquiry.save();

    return res.json({ success: true, message: 'Inquiry marked as read.', inquiry });
  } catch (err) {
    console.error('[Admin Mark Read Error]', err);
    return res.status(500).json({ success: false, message: 'Server error marking inquiry as read.' });
  }
};

/**
 * Update Inquiry Status (Unread, Read, Resolved)
 */
exports.updateInquiryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Unread', 'Read', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status.' });
    }

    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    return res.json({ success: true, message: 'Inquiry status updated successfully.', inquiry });
  } catch (err) {
    console.error('[Admin Update Status Error]', err);
    return res.status(500).json({ success: false, message: 'Server error updating inquiry status.' });
  }
};

/**
 * Get Inquiries & Newsletter Stats
 */
exports.getInquiryStats = async (req, res) => {
  try {
    const totalMessages = await Inquiry.countDocuments();
    const unreadMessages = await Inquiry.countDocuments({ status: 'Unread' });
    const newsletterSubs = await Newsletter.countDocuments({ status: 'Subscribed' });
    const careerApps = await CareerApplication.countDocuments();
    const partnerApps = await PartnerApplication.countDocuments();
    const comingSoonNotifications = await ComingSoonNotification.countDocuments();

    // Calculate new subscribers this week (past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newSubsThisWeek = await Newsletter.countDocuments({
      status: 'Subscribed',
      subscribedAt: { $gte: sevenDaysAgo }
    });

    return res.json({
      success: true,
      stats: {
        totalMessages,
        unreadMessages,
        newsletterSubs,
        newSubsThisWeek,
        careerApps,
        partnerApps,
        comingSoonNotifications
      }
    });

  } catch (err) {
    console.error('[Admin Inquiry Stats Error]', err);
    return res.status(500).json({ success: false, message: 'Server error loading stats.' });
  }
};

/**
 * Get Coming Soon Notification Leads
 */
exports.getComingSoonNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { sourcePage: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await ComingSoonNotification.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const notifications = await ComingSoonNotification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      notifications,
      page,
      pages,
      total
    });
  } catch (err) {
    console.error('[Admin Coming Soon Notifications Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving coming soon notifications.' });
  }
};

/**
 * Mark Coming Soon Notification as Viewed
 */
exports.markComingSoonNotificationViewed = async (req, res) => {
  try {
    const notification = await ComingSoonNotification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification lead not found.' });
    }

    notification.status = 'Viewed';
    await notification.save();

    return res.json({ success: true, message: 'Notification lead marked as viewed.', notification });
  } catch (err) {
    console.error('[Admin Coming Soon Viewed Error]', err);
    return res.status(500).json({ success: false, message: 'Server error updating notification lead.' });
  }
};

/**
 * Get Newsletter Subscribers
 */
exports.getNewsletterSubs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    const total = await Newsletter.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const subscribers = await Newsletter.find(query)
      .sort({ subscribedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      subscribers,
      page,
      pages,
      total
    });

  } catch (err) {
    console.error('[Admin Newsletter Subs Error]', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving subscribers.' });
  }
};

/**
 * Delete / Remove Newsletter Subscriber
 */
exports.deleteNewsletterSub = async (req, res) => {
  try {
    const subscriber = await Newsletter.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found.' });
    }
    return res.json({ success: true, message: 'Subscriber removed successfully.' });
  } catch (err) {
    console.error('[Admin Delete Subscriber Error]', err);
    return res.status(500).json({ success: false, message: 'Server error removing subscriber.' });
  }
};
