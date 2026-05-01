// In-memory store for temporary users during OTP verification
const tempUsers = new Map();

const OTP_EXPIRY = (process.env.OTP_EXPIRE_MINUTES || 5) * 60 * 1000;
const RESEND_COOLDOWN = (process.env.OTP_RESEND_COOLDOWN || 60) * 1000;

const storeTempUser = (identifier, data) => {
  tempUsers.set(identifier, {
    ...data,
    createdAt: Date.now(),
    lastSent: Date.now(),
    attempts: 0,
    maxAttempts: process.env.OTP_MAX_ATTEMPTS || 5,
  });
};

const getTempUser = (identifier) => tempUsers.get(identifier);

const deleteTempUser = (identifier) => tempUsers.delete(identifier);

const isExpired = (user) => {
  return Date.now() - user.createdAt > OTP_EXPIRY;
};

const canResend = (user) => {
  return Date.now() - user.lastSent >= RESEND_COOLDOWN;
};

const incrementAttempts = (user) => {
  user.attempts += 1;
  return user.maxAttempts - user.attempts;
};

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  for (const [identifier, user] of tempUsers.entries()) {
    if (now - user.createdAt > OTP_EXPIRY) {
      tempUsers.delete(identifier);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired temp users`);
  }
}, 60000);

module.exports = {
  storeTempUser,
  getTempUser,
  deleteTempUser,
  isExpired,
  canResend,
  incrementAttempts,
};