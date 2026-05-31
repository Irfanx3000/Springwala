const mongoose = require('mongoose');

const ComingSoonNotificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email address is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  sourcePage: {
    type: String,
    required: true,
    trim: true,
    default: 'coming-soon.html'
  },
  status: {
    type: String,
    enum: ['New', 'Viewed'],
    default: 'New'
  }
}, { timestamps: true });

ComingSoonNotificationSchema.index({ email: 1, sourcePage: 1 }, { unique: true });

module.exports = mongoose.model('ComingSoonNotification', ComingSoonNotificationSchema);
