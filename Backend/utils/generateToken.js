const jwt = require('jsonwebtoken');

/**
 * Generates a JWT for a regular USER.
 *
 * IMPORTANT: embeds role:'user' so userAuth middleware can distinguish
 * user tokens from admin tokens and reject admin tokens on user routes.
 * Admin tokens (generated in adminAuthController) carry no role claim,
 * so decoded.role !== 'user' is always true for them — they are rejected.
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = generateToken;
