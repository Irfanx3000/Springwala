const Banner = require('../models/Banner');
const fs = require('fs');
const path = require('path');

// @desc    Get banners (optionally by type)
// @route   GET /api/banners
exports.getBanners = async (req, res) => {
  try {
    const { type, isActive, search, sort } = req.query;
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { altText: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = { position: 1, createdAt: -1 }; // Default
    if (sort === 'newest') sortOption = { createdAt: -1 };
    else if (sort === 'oldest') sortOption = { createdAt: 1 };
    else if (sort === 'position-high') sortOption = { position: -1 };
    else if (sort === 'position-low') sortOption = { position: 1 };

    const banners = await Banner.find(query).sort(sortOption);
    res.json({ success: true, count: banners.length, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get single banner
// @route   GET /api/banners/:id
exports.getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create banner
// @route   POST /api/banners
exports.createBanner = async (req, res) => {
  try {
    const files = req.files || {};
    if (!files.image) return res.status(400).json({ success: false, message: 'Banner desktop image is required' });

    const { title, type, link, altText, isActive, position, startDate, endDate } = req.body;
    const image = `/uploads/banners/${files.image[0].filename}`;
    let mobileImage = null;
    if (files.mobileImage) mobileImage = `/uploads/banners/${files.mobileImage[0].filename}`;

    const banner = await Banner.create({
      title, type, image, mobileImage, link: link || '',
      altText: altText || title,
      isActive: isActive !== 'false',
      position: Number(position) || 0,
      sortOrder: Number(position) || 0,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    res.status(201).json({ success: true, message: 'Banner created successfully', banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

    const { title, link, altText, isActive, position, startDate, endDate } = req.body;
    if (title) banner.title = title;
    if (link !== undefined) banner.link = link;
    if (altText !== undefined) banner.altText = altText;
    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;
    if (position !== undefined) {
      banner.position = Number(position);
      banner.sortOrder = Number(position);
    }
    if (startDate !== undefined) banner.startDate = startDate || null;
    if (endDate !== undefined) banner.endDate = endDate || null;

    const files = req.files || {};
    // Handle Desktop Image
    if (files.image) {
      const oldPath = path.join(__dirname, '..', banner.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      banner.image = `/uploads/banners/${files.image[0].filename}`;
    }
    // Handle Mobile Image
    if (files.mobileImage) {
      if (banner.mobileImage) {
        const oldPath = path.join(__dirname, '..', banner.mobileImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      banner.mobileImage = `/uploads/banners/${files.mobileImage[0].filename}`;
    }

    await banner.save();
    res.json({ success: true, message: 'Banner updated successfully', banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

    // Delete Desktop Image
    const desktopPath = path.join(__dirname, '..', banner.image);
    if (fs.existsSync(desktopPath)) fs.unlinkSync(desktopPath);

    // Delete Mobile Image
    if (banner.mobileImage) {
      const mobilePath = path.join(__dirname, '..', banner.mobileImage);
      if (fs.existsSync(mobilePath)) fs.unlinkSync(mobilePath);
    }

    await banner.deleteOne();
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle banner active
// @route   PATCH /api/banners/:id/toggle
exports.toggleBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    banner.isActive = !banner.isActive;
    await banner.save();
    res.json({ success: true, message: `Banner ${banner.isActive ? 'activated' : 'deactivated'}`, isActive: banner.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Reorder banners
// @route   PUT /api/banners/reorder
exports.reorderBanners = async (req, res) => {
  try {
    const { order } = req.body; // [{ id, sortOrder }]
    await Promise.all(order.map(item => Banner.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder })));
    res.json({ success: true, message: 'Banners reordered successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// @desc    Get public banners (homepage)
// @route   GET /api/banners/public
exports.getPublicBanners = async (req, res) => {
  try {
    const now = new Date();

    const banners = await Banner.find({
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: null },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: null },
            { endDate: { $gte: now } }
          ]
        }
      ]
    })
    .sort({ position: 1, createdAt: -1 });

    res.json({
      success: true,
      count: banners.length,
      banners
    });

  } catch (err) {
    console.error("❌ Banner Public Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load banners"
    });
  }
};