const nodemailer = require('nodemailer');

class EmailServiceMVP {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            // Use environment variables for email configuration
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER || process.env.EMAIL_USER,
                    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
                }
            });

            console.log('✅ Email service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error.message);
        }
    }

    // Send email verification
    async sendVerificationEmail(email, token, userType) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping verification email');
                return;
            }

            const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email/${token}`;
            const userTypeLabel = userType === 'restaurant' ? 'Restaurant' : 'Food Influencer';

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Verify Your FoodConnect Malaysia Account',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Welcome to FoodConnect Malaysia!</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #0F4C75;">Verify Your ${userTypeLabel} Account</h2>

                            <p>Thank you for joining FoodConnect Malaysia! To complete your registration, please verify your email address by clicking the button below:</p>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${verificationUrl}"
                                   style="background: #0F4C75; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Verify Email Address
                                </a>
                            </div>

                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>

                            <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 5px;">
                                <h3 style="color: #0F4C75; margin-top: 0;">What's Next?</h3>
                                <ol>
                                    <li>Click the verification link above</li>
                                    <li>Your account will be submitted for admin approval</li>
                                    <li>You'll receive an email when your account is approved</li>
                                    <li>Start creating campaigns or applying to opportunities!</li>
                                </ol>
                            </div>

                            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                                This verification link will expire in 24 hours. If you didn't create an account with FoodConnect Malaysia, please ignore this email.
                            </p>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Verification email sent to:', email);

        } catch (error) {
            console.error('❌ Failed to send verification email:', error.message);
            throw error;
        }
    }

    // Send approval email
    async sendApprovalEmail(email, userType) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping approval email');
                return;
            }

            const loginUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/login`;
            const userTypeLabel = userType === 'restaurant' ? 'Restaurant' : 'Food Influencer';

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: email,
                subject: '🎉 Your FoodConnect Malaysia Account is Approved!',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">🎉 Account Approved!</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #27ae60;">Welcome to FoodConnect Malaysia!</h2>

                            <p>Great news! Your ${userTypeLabel.toLowerCase()} account has been approved and is now active. You can start using all the features of our platform immediately.</p>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${loginUrl}"
                                   style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Login to Your Account
                                </a>
                            </div>

                            <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 5px;">
                                <h3 style="color: #27ae60; margin-top: 0;">What You Can Do Now:</h3>
                                ${userType === 'restaurant' ? `
                                    <ul>
                                        <li>Create and publish marketing campaigns</li>
                                        <li>Review applications from talented influencers</li>
                                        <li>Manage campaign budgets and payments</li>
                                        <li>Communicate directly with selected influencers</li>
                                        <li>Review and approve content before posting</li>
                                    </ul>
                                ` : `
                                    <ul>
                                        <li>Browse and apply to restaurant campaigns</li>
                                        <li>Showcase your social media presence</li>
                                        <li>Request follower count updates</li>
                                        <li>Communicate with restaurant partners</li>
                                        <li>Submit content for approval and get paid</li>
                                    </ul>
                                `}
                            </div>

                            <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 5px;">
                                <h3 style="color: #856404; margin-top: 0;">Getting Started Tips:</h3>
                                <ul>
                                    <li>Complete your profile with detailed information</li>
                                    <li>Upload high-quality photos and portfolio examples</li>
                                    <li>Read our community guidelines and best practices</li>
                                    <li>Join our community groups for tips and updates</li>
                                </ul>
                            </div>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                            <p style="margin: 10px 0 0 0; font-size: 14px;">
                                Need help? Contact us at admin@foodconnect.my
                            </p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Approval email sent to:', email);

        } catch (error) {
            console.error('❌ Failed to send approval email:', error.message);
            throw error;
        }
    }

    // Send rejection email
    async sendRejectionEmail(email, userType, reason) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping rejection email');
                return;
            }

            const supportEmail = process.env.ADMIN_EMAIL || 'admin@foodconnect.my';
            const userTypeLabel = userType === 'restaurant' ? 'Restaurant' : 'Food Influencer';

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Update on Your FoodConnect Malaysia Application',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Application Update</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #e74c3c;">Application Status Update</h2>

                            <p>Thank you for your interest in joining FoodConnect Malaysia as a ${userTypeLabel.toLowerCase()}.</p>

                            <p>After careful review, we're unable to approve your application at this time.</p>

                            ${reason ? `
                                <div style="margin: 20px 0; padding: 20px; background: #fff5f5; border-left: 4px solid #e74c3c; border-radius: 5px;">
                                    <h3 style="color: #e74c3c; margin-top: 0;">Reason:</h3>
                                    <p style="margin-bottom: 0;">${reason}</p>
                                </div>
                            ` : ''}

                            <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 5px;">
                                <h3 style="color: #0F4C75; margin-top: 0;">What You Can Do:</h3>
                                <ul>
                                    <li>Review and update your profile information</li>
                                    <li>Ensure all social media links are valid and active</li>
                                    <li>Add more portfolio examples or business details</li>
                                    <li>Contact our support team for specific feedback</li>
                                    <li>Re-apply after addressing the feedback</li>
                                </ul>
                            </div>

                            <p style="margin-top: 30px;">
                                If you have questions about this decision or need clarification, please don't hesitate to contact our support team at
                                <a href="mailto:${supportEmail}" style="color: #0F4C75;">${supportEmail}</a>
                            </p>

                            <p>We appreciate your interest in FoodConnect Malaysia and encourage you to re-apply in the future.</p>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Rejection email sent to:', email);

        } catch (error) {
            console.error('❌ Failed to send rejection email:', error.message);
            throw error;
        }
    }

    // Send password reset email
    async sendPasswordResetEmail(email, resetToken) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping password reset email');
                return;
            }

            const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Reset Your FoodConnect Malaysia Password',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #0F4C75;">Reset Your Password</h2>

                            <p>We received a request to reset your password for your FoodConnect Malaysia account.</p>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}"
                                   style="background: #0F4C75; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Reset Password
                                </a>
                            </div>

                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #666;">${resetUrl}</p>

                            <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 5px;">
                                <h3 style="color: #856404; margin-top: 0;">Security Note:</h3>
                                <ul>
                                    <li>This link will expire in 1 hour</li>
                                    <li>If you didn't request this reset, please ignore this email</li>
                                    <li>Your password won't change until you create a new one</li>
                                </ul>
                            </div>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Password reset email sent to:', email);

        } catch (error) {
            console.error('❌ Failed to send password reset email:', error.message);
            throw error;
        }
    }

    // Send application notification (to restaurant)
    async sendApplicationNotification(restaurantEmail, campaign, influencer) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping application notification');
                return;
            }

            const dashboardUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`;

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: restaurantEmail,
                subject: `New Application for "${campaign.title}"`,
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">🎯 New Campaign Application!</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #f39c12;">New Influencer Application</h2>

                            <p>Great news! You've received a new application for your campaign:</p>

                            <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 5px; border-left: 4px solid #f39c12;">
                                <h3 style="color: #f39c12; margin-top: 0;">${campaign.title}</h3>
                                <p><strong>Influencer:</strong> ${influencer.display_name}</p>
                                <p><strong>Tier:</strong> ${influencer.tier}</p>
                                <p><strong>Location:</strong> ${influencer.location}</p>
                            </div>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${dashboardUrl}"
                                   style="background: #f39c12; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Review Application
                                </a>
                            </div>

                            <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 5px;">
                                <h3 style="color: #27ae60; margin-top: 0;">Next Steps:</h3>
                                <ol>
                                    <li>Review the influencer's profile and portfolio</li>
                                    <li>Check their social media presence and engagement</li>
                                    <li>Accept or decline the application</li>
                                    <li>Start communicating with selected influencers</li>
                                </ol>
                            </div>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Application notification sent to:', restaurantEmail);

        } catch (error) {
            console.error('❌ Failed to send application notification:', error.message);
            throw error;
        }
    }

    // Send application status update (to influencer)
    async sendApplicationStatusUpdate(influencerEmail, campaign, status, message = null) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping application status email');
                return;
            }

            const dashboardUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`;
            const isAccepted = status === 'accepted';

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: influencerEmail,
                subject: `Application ${isAccepted ? 'Accepted' : 'Update'}: ${campaign.title}`,
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, ${isAccepted ? '#27ae60, #2ecc71' : '#e74c3c, #c0392b'}); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">${isAccepted ? '🎉 Application Accepted!' : '📋 Application Update'}</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: ${isAccepted ? '#27ae60' : '#e74c3c'};">Application Status Update</h2>

                            <p>Your application for the following campaign has been <strong>${status}</strong>:</p>

                            <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 5px; border-left: 4px solid ${isAccepted ? '#27ae60' : '#e74c3c'};">
                                <h3 style="color: ${isAccepted ? '#27ae60' : '#e74c3c'}; margin-top: 0;">${campaign.title}</h3>
                                <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1)}</p>
                                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
                            </div>

                            ${isAccepted ? `
                                <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 5px;">
                                    <h3 style="color: #27ae60; margin-top: 0;">🎊 Congratulations!</h3>
                                    <p>You've been selected for this campaign. Here's what happens next:</p>
                                    <ol>
                                        <li>Start communicating with the restaurant</li>
                                        <li>Plan your content creation timeline</li>
                                        <li>Create amazing video content</li>
                                        <li>Submit for approval</li>
                                        <li>Post on your platforms and get paid!</li>
                                    </ol>
                                </div>
                            ` : `
                                <div style="margin-top: 30px; padding: 20px; background: #fff5f5; border-radius: 5px;">
                                    <h3 style="color: #e74c3c; margin-top: 0;">Keep Going!</h3>
                                    <p>Don't worry - there are plenty more opportunities available:</p>
                                    <ul>
                                        <li>Browse other active campaigns</li>
                                        <li>Update your profile and portfolio</li>
                                        <li>Improve your application strategy</li>
                                        <li>Keep engaging with your audience</li>
                                    </ul>
                                </div>
                            `}

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${dashboardUrl}"
                                   style="background: ${isAccepted ? '#27ae60' : '#0F4C75'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Go to Dashboard
                                </a>
                            </div>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Application status email sent to:', influencerEmail);

        } catch (error) {
            console.error('❌ Failed to send application status email:', error.message);
            throw error;
        }
    }

    // Send content review notification
    async sendContentReviewNotification(influencerEmail, campaign, status, feedback = null) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping content review notification');
                return;
            }

            const dashboardUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`;
            const isApproved = status === 'approved';

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: influencerEmail,
                subject: `Content ${isApproved ? 'Approved' : 'Needs Revision'}: ${campaign.title}`,
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, ${isApproved ? '#27ae60, #2ecc71' : '#f39c12, #e67e22'}); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">${isApproved ? '✅ Content Approved!' : '📝 Content Review'}</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: ${isApproved ? '#27ae60' : '#f39c12'};">Content Review Results</h2>

                            <p>Your content submission for <strong>${campaign.title}</strong> has been reviewed.</p>

                            ${isApproved ? `
                                <div style="margin: 20px 0; padding: 20px; background: #e8f5e8; border-radius: 5px; border-left: 4px solid #27ae60;">
                                    <h3 style="color: #27ae60; margin-top: 0;">🎉 Content Approved!</h3>
                                    <p>Congratulations! Your content has been approved. You can now post it on your social media platforms.</p>
                                    ${feedback ? `<p><strong>Restaurant's Note:</strong> ${feedback}</p>` : ''}
                                </div>

                                <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 5px;">
                                    <h3 style="color: #0F4C75; margin-top: 0;">Next Steps:</h3>
                                    <ol>
                                        <li>Post your content on all agreed platforms</li>
                                        <li>Mark the content as "Posted" in your dashboard</li>
                                        <li>Payment will be processed automatically</li>
                                        <li>Share your success with the community!</li>
                                    </ol>
                                </div>
                            ` : `
                                <div style="margin: 20px 0; padding: 20px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #f39c12;">
                                    <h3 style="color: #856404; margin-top: 0;">Revision Requested</h3>
                                    <p>The restaurant has requested some changes to your content before approval.</p>
                                    ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
                                </div>

                                <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 5px;">
                                    <h3 style="color: #0F4C75; margin-top: 0;">What to Do:</h3>
                                    <ol>
                                        <li>Review the feedback carefully</li>
                                        <li>Make the requested adjustments</li>
                                        <li>Resubmit your improved content</li>
                                        <li>Communicate with the restaurant if needed</li>
                                    </ol>
                                </div>
                            `}

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${dashboardUrl}"
                                   style="background: ${isApproved ? '#27ae60' : '#f39c12'}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    ${isApproved ? 'Mark as Posted' : 'Revise Content'}
                                </a>
                            </div>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Content review notification sent to:', influencerEmail);

        } catch (error) {
            console.error('❌ Failed to send content review notification:', error.message);
            throw error;
        }
    }

    // Send payment notification
    async sendPaymentReleaseEmail(influencerEmail, payment) {
        try {
            if (!this.transporter) {
                console.log('📧 Email service not configured, skipping payment notification');
                return;
            }

            const dashboardUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard`;

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: influencerEmail,
                subject: '💰 Payment Released - FoodConnect Malaysia',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">💰 Payment Released!</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #f39c12;">Payment Processed Successfully</h2>

                            <p>Great news! Your payment has been released and is on its way to your account.</p>

                            <div style="margin: 20px 0; padding: 20px; background: white; border-radius: 5px; border-left: 4px solid #f39c12;">
                                <h3 style="color: #f39c12; margin-top: 0;">Payment Details</h3>
                                <p><strong>Campaign:</strong> ${payment.campaign_title}</p>
                                <p><strong>Amount:</strong> RM ${payment.net_amount}</p>
                                <p><strong>Transaction ID:</strong> ${payment.transaction_reference || payment.id}</p>
                            </div>

                            <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 5px;">
                                <h3 style="color: #27ae60; margin-top: 0;">🎊 Congratulations!</h3>
                                <p>You've successfully completed your first campaign! Here are some tips for future success:</p>
                                <ul>
                                    <li>Update your portfolio with this campaign</li>
                                    <li>Ask for testimonials from satisfied partners</li>
                                    <li>Apply to more campaigns to grow your income</li>
                                    <li>Share your success story with the community</li>
                                </ul>
                            </div>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${dashboardUrl}"
                                   style="background: #f39c12; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    View Payment History
                                </a>
                            </div>

                            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                                Payment processing may take 1-3 business days depending on your bank. If you have any questions, please contact our support team.
                            </p>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Payment release email sent to:', influencerEmail);

        } catch (error) {
            console.error('❌ Failed to send payment release email:', error.message);
            throw error;
        }
    }

    // Test email configuration
    async testEmailConfiguration() {
        try {
            if (!this.transporter) {
                throw new Error('Email transporter not configured');
            }

            await this.transporter.verify();
            console.log('✅ Email configuration test successful');
            return true;
        } catch (error) {
            console.error('❌ Email configuration test failed:', error.message);
            return false;
        }
    }

    // Send test email
    async sendTestEmail(toEmail) {
        try {
            if (!this.transporter) {
                throw new Error('Email service not configured');
            }

            const mailOptions = {
                from: `"FoodConnect Malaysia" <${process.env.SMTP_USER}>`,
                to: toEmail,
                subject: 'Test Email - FoodConnect Malaysia',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #0F4C75 0%, #1a5d8a 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">🧪 Test Email</h1>
                        </div>

                        <div style="padding: 30px; background: #f8f9fa;">
                            <h2 style="color: #0F4C75;">Email Service Test</h2>
                            <p>This is a test email from FoodConnect Malaysia email service.</p>
                            <p><strong>Status:</strong> Email service is working correctly! ✅</p>
                            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                        </div>

                        <div style="background: #333; color: white; padding: 20px; text-align: center;">
                            <p style="margin: 0;">© 2024 FoodConnect Malaysia. All rights reserved.</p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('✅ Test email sent successfully to:', toEmail);
            return true;

        } catch (error) {
            console.error('❌ Failed to send test email:', error.message);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new EmailServiceMVP();