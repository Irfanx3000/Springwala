const express = require('express');
const router = express.Router();
const {
  submitApplication,
  getApplications,
  getApplication,
  updateStatus,
  deleteApplication
} = require('../controllers/careerController');
const { protect } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');

// Public user-facing application submission + resume upload
router.post('/', uploadResume.single('resume'), submitApplication);

// Protected Admin management endpoints
router.get('/', protect, getApplications);
router.get('/:id', protect, getApplication);
router.patch('/:id/status', protect, updateStatus);
router.delete('/:id', protect, deleteApplication);

module.exports = router;
