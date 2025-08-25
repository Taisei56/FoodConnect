const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendVerificationEmail(email, name, verificationToken, userType) {
        const verificationUrl = `${process.env.BASE_URL}/auth/verify-email?token=${verificationToken}`;
        
        const subject = `Verify your ${userType} account - FoodConnect Malaysia`;
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email - FoodConnect Malaysia</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); color: white; padding: 40px 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
                .content { padding: 40px 30px; }
                .content h2 { color: #0F4C75; margin: 0 0 20px 0; font-size: 24px; }
                .content p { margin: 0 0 20px 0; color: #64748b; font-size: 16px; }
                .verify-btn { display: inline-block; background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; transition: all 0.3s ease; }
                .verify-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 76, 117, 0.3); }
                .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
                .footer p { margin: 0; color: #64748b; font-size: 14px; }
                .security-note { background-color: #fef7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .security-note p { margin: 0; color: #ea580c; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Welcome to FoodConnect Malaysia!</h1>
                    <p>Malaysia's Premier Food Collaboration Platform</p>
                </div>
                
                <div class="content">
                    <h2>Hi ${name}! 👋</h2>
                    <p>Thank you for registering as a <strong>${userType}</strong> with FoodConnect Malaysia. You're one step away from joining Malaysia's most exciting food collaboration platform!</p>
                    
                    <p>To complete your registration and verify your email address, please click the button below:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" class="verify-btn">✅ Verify My Email</a>
                    </div>
                    
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">${verificationUrl}</p>
                    
                    <div class="security-note">
                        <p><strong>🔒 Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
                    </div>
                    
                    <p>Once verified, you'll have full access to our platform and can start connecting with ${userType === 'restaurant' ? 'amazing food influencers' : 'fantastic restaurants'} across Malaysia!</p>
                    
                    <p>Have questions? Simply reply to this email and we'll get back to you soon.</p>
                    
                    <p>Excited to have you on board! 🎉</p>
                    <p><strong>The FoodConnect Malaysia Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© 2025 FoodConnect Malaysia. Connecting restaurants with food influencers across Malaysia.</p>
                    <p>This email was sent to ${email}. If you didn't sign up for FoodConnect Malaysia, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>`;

        const mailOptions = {
            from: `${process.env.FROM_NAME || 'FoodConnect Malaysia'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: email,
            subject: subject,
            html: html,
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Verification email sent to ${email}:`, result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Error sending verification email:', error);
            throw error;
        }
    }

    async sendWelcomeEmail(email, name, userType) {
        const subject = `Welcome to FoodConnect Malaysia! Your ${userType} account is verified ✅`;
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to FoodConnect Malaysia</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
                .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                .content { padding: 40px 30px; }
                .content h2 { color: #0F4C75; margin: 0 0 20px 0; font-size: 24px; }
                .content p { margin: 0 0 20px 0; color: #64748b; font-size: 16px; }
                .highlight-box { background: linear-gradient(135deg, #f0fff4 0%, #ecfdf5 100%); border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .highlight-box h3 { margin: 0 0 10px 0; color: #059669; }
                .cta-btn { display: inline-block; background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
                .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
                .footer p { margin: 0; color: #64748b; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to FoodConnect Malaysia!</h1>
                    <p>Your account is now verified and ready to go!</p>
                </div>
                
                <div class="content">
                    <h2>Congratulations, ${name}! ✅</h2>
                    <p>Your ${userType} account has been successfully verified and you're now part of the FoodConnect Malaysia community!</p>
                    
                    <div class="highlight-box">
                        <h3>🚀 What's next?</h3>
                        <p><strong>You can now:</strong></p>
                        <ul>
                            <li>✨ Complete your profile with more details</li>
                            <li>🔍 ${userType === 'restaurant' ? 'Browse food influencers and create campaigns' : 'Discover restaurant campaigns and apply'}</li>
                            <li>🤝 Start connecting with potential collaboration partners</li>
                            <li>💬 Access our full messaging and collaboration tools</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.BASE_URL}/dashboard" class="cta-btn">🏠 Go to Dashboard</a>
                    </div>
                    
                    <p><strong>Need help getting started?</strong></p>
                    <ul>
                        <li>📖 Check out our user guide and best practices</li>
                        <li>💡 Browse successful collaboration examples</li>
                        <li>📞 Contact our support team if you have questions</li>
                    </ul>
                    
                    <p>We're excited to see the amazing collaborations you'll create on our platform!</p>
                    
                    <p>Welcome aboard! 🚀</p>
                    <p><strong>The FoodConnect Malaysia Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© 2025 FoodConnect Malaysia. Connecting restaurants with food influencers across Malaysia.</p>
                    <p>You're receiving this because you verified your account at FoodConnect Malaysia.</p>
                </div>
            </div>
        </body>
        </html>`;

        const mailOptions = {
            from: `${process.env.FROM_NAME || 'FoodConnect Malaysia'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: email,
            subject: subject,
            html: html,
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Welcome email sent to ${email}:`, result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Error sending welcome email:', error);
            throw error;
        }
    }
}

module.exports = new EmailService();