const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP verification email via Resend
 */
const sendOTPEmail = async (email, otp) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Verify Your Springwala Account</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #BE2229 0%, #8B1A1F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .otp-code { font-size: 42px; font-weight: bold; color: #BE2229; text-align: center; letter-spacing: 8px; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 Springwala</h1>
            <p>Your Trusted Partner</p>
          </div>
          <div style="padding: 30px;">
            <h2>Verify Your Email Address</h2>
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p>This code expires in <strong>5 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Springwala. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: '🔐 Springwala - Your Verification Code',
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send verification email');
    }

    console.log(`✅ Email OTP sent to ${email}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Email service error:', error);
    throw new Error('Unable to send verification email. Please try again later.');
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetUrl, firstName) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reset Your Springwala Password</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #BE2229 0%, #8B1A1F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .button { display: inline-block; padding: 12px 30px; background: #BE2229; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 Springwala</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Password Reset Request</h2>
            <p>Hello ${firstName},</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>This link expires in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Springwala. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: '🔐 Reset Your Springwala Password',
      html: htmlContent,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Reset email error:', error);
    throw new Error('Failed to send password reset email');
  }
};

const fs = require('fs');

/**
 * Send order confirmation email with PDF invoice attachment
 */
const sendOrderConfirmationEmail = async ({ email, name, order, invoicePath }) => {
  try {
    const fileBuffer = fs.readFileSync(invoicePath);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Confirmed - Springwala</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 10px; border: 1px solid #eee; }
          .header { background: linear-gradient(135deg, #BE2229 0%, #8B1A1F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
          .amount { font-size: 24px; font-weight: bold; color: #BE2229; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Order Confirmed!</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello ${name},</h2>
            <p>Thank you for your order! We've received it and are getting it ready for shipment.</p>
            
            <div class="order-details">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Total Amount:</strong> <span class="amount">₹${order.totalAmount.toFixed(2)}</span></p>
              <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            </div>

            <p>Your invoice is attached to this email for your records.</p>
            <p>We'll notify you as soon as your items are shipped.</p>
            
            <p>Happy Shopping,<br>Team Springwala</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Springwala. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: `✅ Order Confirmed - ${order.orderNumber}`,
      html: htmlContent,
      attachments: [
        {
          filename: `${order.orderNumber}.pdf`,
          content: fileBuffer
        }
      ]
    });

    if (error) throw error;
    console.log(`📧 Order confirmation email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Order confirmation email error:', error);
    // Don't throw error to avoid blocking the main order flow
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };