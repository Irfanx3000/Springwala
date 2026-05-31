const express = require("express");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");

require("dotenv").config();

const connectDB = require("./config/database");
const { errorMiddleware } = require("./middleware/errorMiddleware");

// Google OAuth strategy registration
require("./config/passport");

const app = express();

// 🔥 IMPORTANT: Required behind Nginx (fixes session/cookies)
app.set("trust proxy", 1);

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Core middleware ───────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5500",
  "http://localhost:5503",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5503",

  "http://springwala.in",
  "https://springwala.in",

  "http://www.springwala.in",
  "https://www.springwala.in",
];

console.log("[CORS] Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without origin
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true);
      }

      // Allow production domains
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("[CORS BLOCKED]", origin);

      return callback(new Error("CORS not allowed"));
    },

    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Session (FIXED for production) ─────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // 🔥 required for HTTPS
      sameSite: "none", // 🔥 required for cross-origin
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// ── Static file serving (FIXED) ───────────────────────────────────────────────
app.use("/uploads", express.static("uploads")); // ✅ correct path

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.use("/api/auth", require("./routes/adminAuth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/users", require("./routes/adminUsers"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/banners", require("./routes/banners"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/search", require("./routes/search"));
app.use("/api/admin", require("./routes/adminManageRoutes"));
app.use("/api/shipping", require("./routes/shippingRoutes"));
app.use("/api/inquiries", require("./routes/inquiryRoutes"));
app.use("/api/careers", require("./routes/careerRoutes"));
app.use("/api/partners", require("./routes/partnerRoutes"));
app.use("/api/admin/partners", require("./routes/adminPartnerRoutes"));


// ══════════════════════════════════════════════════════════════════════════════
//  USER AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.use("/api/auth", require("./routes/authRoutes"));

// ══════════════════════════════════════════════════════════════════════════════
//  USER-FACING ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "Server is running",
    env: process.env.NODE_ENV,
  }),
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res
    .status(404)
    .json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    }),
);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(
    `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
  ),
);

module.exports = app;
