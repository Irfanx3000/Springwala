const express  = require('express');
const cors     = require('cors');
const passport = require('passport');
const session  = require('express-session');

require('dotenv').config();

const connectDB           = require('./config/database');
const { errorMiddleware } = require('./middleware/errorMiddleware');

// Google OAuth strategy registration
require('./config/passport');

const app = express();

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session required for Passport Google OAuth (serializeUser / deserializeUser)
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// Static file serving for uploaded images
app.use('/uploads', express.static('uploads'));

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
//  JWT middleware: middleware/auth.js  →  checks Admin model only
//  Admin login: POST /api/auth/admin/login
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/auth',       require('./routes/adminAuth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/users',      require('./routes/adminUsers'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/banners',    require('./routes/banners'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/search',     require('./routes/search'));

// ══════════════════════════════════════════════════════════════════════════════
//  USER AUTH ROUTES
//  Register / OTP / Login / Forgot-password / Google OAuth
//  JWT middleware: middleware/userAuth.js  →  checks User model only
//  User login: POST /api/auth/login
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/auth', require('./routes/authRoutes'));

// ══════════════════════════════════════════════════════════════════════════════
//  USER-FACING ROUTES  (profile, cart, orders, product browsing, categories)
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'Server is running', env: process.env.NODE_ENV })
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`)
);

module.exports = app;
