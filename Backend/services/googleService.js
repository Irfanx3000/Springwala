const { OAuth2Client } = require('google-auth-library');

class GoogleService {
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
  }

  /**
   * Verify Google ID Token
   * @param {string} token - Google ID token
   * @returns {Promise<object>} User info from Google
   */
  async verifyToken(token) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      return {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        picture: payload.picture,
        isVerified: payload.email_verified,
      };
    } catch (error) {
      console.error('Google Token Verification Error:', error.message);
      throw new Error('Invalid Google token');
    }
  }
}

module.exports = new GoogleService();