// services/otpService.js - TESTING VERSION (No DLT Required)
const axios = require('axios');

class OTPService {
  constructor() {
    this.authKey = process.env.MSG91_API_KEY;
    this.senderId = 'msgind'; // MSG91's default test sender ID
    this.baseUrl = 'https://api.msg91.com/api/v5';
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP using MSG91's TEST MODE (No DLT required)
   */
  async sendOTPSMS(phoneNumber, otp) {
    try {
      // Format phone number
      let mobile = phoneNumber.replace(/\s/g, '');
      if (!mobile.startsWith('91')) {
        mobile = `91${mobile}`;
      }
      mobile = mobile.replace('+', '');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 Sending TEST SMS');
      console.log(`📞 Mobile: ${mobile}`);
      console.log(`🔐 OTP: ${otp}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Method 1: MSG91 OTP API (Test Mode)
      const payload = {
        mobile: mobile,
        authkey: this.authKey,
        otp: otp,
        sender: this.senderId,
        otp_expiry: 5,
      };

      const response = await axios.post(`${this.baseUrl}/otp`, payload, {
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log('📥 Response:', JSON.stringify(response.data, null, 2));

      if (response.data.type === 'success') {
        console.log('✅ Test SMS sent! Check your phone.');
        return {
          success: true,
          channel: 'sms',
          messageId: response.data.messageId,
        };
      } else {
        // If OTP API fails, try HTTP API
        return await this.sendOTPHTTP(mobile, otp);
      }
    } catch (error) {
      console.error('❌ SMS Error:', error.message);
      return this.devModeFallback(phoneNumber, otp);
    }
  }

  /**
   * Alternative: HTTP API (Works without template)
   */
  async sendOTPHTTP(mobile, otp) {
    try {
      const message = `Your OTP for Springwala verification is ${otp}. Valid for 5 minutes. - Springwala`;
      
      const params = {
        authkey: this.authKey,
        mobiles: mobile,
        message: message,
        sender: this.senderId,
        route: '4', // Transactional route
        country: '91',
      };

      const response = await axios.get('https://api.msg91.com/api/sendhttp.php', {
        params: params,
        timeout: 10000,
      });

      console.log('HTTP Response:', response.data);

      if (response.data.includes('Success')) {
        console.log('✅ SMS sent via HTTP API');
        return { success: true, channel: 'sms' };
      } else {
        throw new Error(response.data);
      }
    } catch (error) {
      console.error('HTTP API Error:', error.message);
      return this.devModeFallback(mobile, otp);
    }
  }

  /**
   * Development fallback - shows OTP in console
   */
  devModeFallback(phoneNumber, otp) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║         📱 SMS DEVELOPMENT MODE                    ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║ 📞 Phone: ${phoneNumber}`);
    console.log(`║ 🔐 OTP: ${otp}`);
    console.log(`║ 💡 Use this OTP for verification`);
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    return {
      success: true,
      channel: 'sms',
      devMode: true,
      devOTP: otp,
    };
  }
}

module.exports = new OTPService();