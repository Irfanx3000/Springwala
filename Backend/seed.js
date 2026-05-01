require('dotenv').config();
const mongoose = require('mongoose');

const Order = require('./models/Order');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB Connected");
};

const createOrder = async () => {
  try {
    await connectDB();

    const order = await Order.create({
      user: new mongoose.Types.ObjectId("69db6dbaf797b8986f81a8e8"),

      items: [
        {
          product: new mongoose.Types.ObjectId("69da22b944a9bf9f3b64d262"),
          name: "Fire Extinguisher",
          image: "",
          quantity: 3,
          price: 1599,
          discountedPrice: 1439.1
        }
      ],

      shippingAddress: {
        fullName: "Nizam Shah",
        phone: "7208120335",
        addressLine1: "Mumbai Address",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India"
      },

      subtotal: 4317,
      shippingCharge: 50,
      discount: 0,
      totalAmount: 4367,

      orderStatus: "Ordered",
      paymentStatus: "Completed",
      paymentMethod: "COD",

      orderId: "SW000002"
    });

    console.log("🎉 Order created:", order._id);

    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

createOrder();