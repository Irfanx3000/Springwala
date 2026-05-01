require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('./models/Banner');

const checkBanners = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const banners = await Banner.find({});
    console.log(`Found ${banners.length} banners:`);
    banners.forEach(b => {
      console.log(`- Title: ${b.title || 'N/A'}, Type: ${b.type}, Device: ${b.device}, Active: ${b.isActive}`);
    });

    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

checkBanners();
