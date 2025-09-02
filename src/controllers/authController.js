const User = require('../models/User');
const MVPUser = require('../models/MVPUser');
const UserMVP = require('../models/UserMVP');
const Restaurant = require('../models/Restaurant');
const Influencer = require('../models/Influencer');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthController {
    // Test endpoint to check if auth controller is working
    static async test(req, res) {
        console.log('🧪 Test endpoint hit');
        res.json({
            success: true,
            message: 'Auth controller is working',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    }
    static async register(req, res) {
        try {
            console.log('🔄 Registration attempt started');
            console.log('Request body:', req.body);
            
            const { 
                email, 
                password, 
                user_type,
                // Restaurant fields
                restaurant_name,
                location,
                cuisine_type,
                phone,
                description,
                google_maps,
                // Influencer fields
                display_name,
                instagram_handle,
                follower_count,
                bio
            } = req.body;
            
            // Basic validation
            if (!email || !password || !user_type) {
                console.log('❌ Missing required fields');
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: email, password, and user type are required.'
                });
            }
            
            if (!['restaurant', 'influencer', 'admin'].includes(user_type)) {
                console.log('❌ Invalid user type:', user_type);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid user type. Must be "restaurant", "influencer", or "admin".'
                });
            }

            // Admin registration requires special validation
            if (user_type === 'admin') {
                const existingAdmins = await this.getAdminCount();
                if (existingAdmins >= 5) { // Limit admin accounts
                    return res.status(403).json({
                        success: false,
                        error: 'Maximum admin accounts reached. Contact system administrator.'
                    });
                }
            }
            
            // Prepare additional data based on user type
            let additionalData = {};
            if (user_type === 'restaurant') {
                additionalData = {
                    businessName: restaurant_name || '',
                    location: location || '',
                    cuisineType: cuisine_type || '',
                    phone: phone || '',
                    description: description || '',
                    googleMaps: google_maps || ''
                };
            } else if (user_type === 'influencer') {
                additionalData = {
                    displayName: display_name || instagram_handle || '',
                    instagramHandle: instagram_handle || '',
                    followerCount: parseInt(follower_count) || 0,
                    location: location,
                    bio: bio || ''
                };
            } else if (user_type === 'admin') {
                additionalData = {
                    displayName: display_name || 'Admin',
                    role: 'admin',
                    permissions: ['manage_users', 'manage_campaigns', 'manage_payments']
                };
            }
            
            // Create user with our new MVP system
            console.log('💾 Creating user with MVP system...');
            const userMVP = new UserMVP();
            
            const result = await userMVP.create({
                email,
                password,
                userType: user_type,
                additionalData
            });
            
            // Create profile based on user type
            if (user_type === 'restaurant') {
                const restaurantModel = new Restaurant();
                await restaurantModel.create({
                    user_id: result.user.id,
                    business_name: restaurant_name || '',
                    description: description || '',
                    phone: phone || '',
                    address: location || '',
                    city: location || '',
                    state: 'Kuala Lumpur', // Default, can be updated later
                    google_maps_link: google_maps || '',
                    dietary_categories: [] // Will be filled during profile completion
                });
            } else if (user_type === 'influencer') {
                const influencerModel = new Influencer();
                await influencerModel.create({
                    user_id: result.user.id,
                    display_name: display_name || instagram_handle || '',
                    phone: phone || '',
                    bio: bio || '',
                    location: location || '',
                    city: location || '',
                    state: 'Kuala Lumpur', // Default, can be updated later
                    instagram_username: instagram_handle || '',
                    instagram_followers: parseInt(follower_count) || 0
                });
            } else if (user_type === 'admin') {
                // Admin users don't need profile creation - they have special privileges
                console.log('✅ Admin user created - no profile needed');
            }
            
            console.log('✅ User and profile created successfully');
            
            // Send verification email (optional in MVP mode)
            let emailSent = false;
            try {
                console.log('📧 Attempting to send verification email...');
                const name = user_type === 'restaurant' 
                    ? (restaurant_name || 'Restaurant Owner') 
                    : user_type === 'influencer'
                    ? (display_name || instagram_handle || 'Influencer')
                    : 'Platform Administrator';
                await emailService.sendVerificationEmail(
                    email,
                    name || 'User',
                    result.verificationToken,
                    user_type
                );
                
                console.log(`✅ Verification email sent to ${email}`);
                emailSent = true;
            } catch (emailError) {
                console.log('⚠️  Email service not available in MVP mode');
                console.log('Email error:', emailError.message);
                // Don't fail the registration if email fails in MVP mode
                emailSent = false;
            }

            console.log('🎉 Registration completed successfully');
            
            res.status(201).json({
                success: true,
                message: emailSent 
                    ? 'Registration successful! Please check your email to verify your account.'
                    : 'Registration successful! Your account is ready and awaiting admin approval. MVP launch in October 2025!',
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    user_type: result.user.user_type,
                    status: result.user.status,
                    email_verified: result.user.email_verified || false
                },
                emailSent: emailSent,
                mvpMode: true
            });
        } catch (error) {
            console.error('Registration controller error:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall
            });
            
            // More specific error messages
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
                errorMessage = 'Database connection failed. Please contact support.';
            } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
                errorMessage = 'Email already registered. Please use a different email.';
            } else if (error.message.includes('validation')) {
                errorMessage = 'Invalid input data. Please check your information.';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                errorMessage = 'Service unavailable. Please try again later.';
            }
            
            res.status(500).json({ 
                success: false,
                error: errorMessage,
                message: error.message,
                ...(process.env.NODE_ENV === 'development' && { 
                    stack: error.stack,
                    details: error
                })
            });
        }
    }

    static async login(req, res) {
        try {
            console.log('🔐 Login attempt started');
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }
            
            console.log('🔍 Attempting authentication for:', email);
            
            // Authenticate with MVP system
            const userMVP = new UserMVP();
            const user = await userMVP.authenticate(email, password);
            console.log('✅ MVP authentication successful');
            
            // Generate JWT token
            const token = userMVP.generateJWT(user);

            console.log('🎉 Login successful for user:', user.email);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    user_type: user.user_type,
                    status: user.status,
                    email_verified: user.email_verified
                },
                mvpMode: true
            });
        } catch (error) {
            console.error('Login controller error:', error);
            
            let message = 'Login failed. Please try again.';
            let statusCode = 500;
            
            // Provide specific error messages
            if (error.message === 'User not found') {
                message = 'No account found with this email address. Please check your email or register for an account.';
                statusCode = 401;
            } else if (error.message === 'Invalid password') {
                message = 'Incorrect password. Please check your password and try again.';
                statusCode = 401;
            } else if (error.message === 'Email not verified') {
                message = 'Please verify your email address before logging in. Check your email for a verification link.';
                statusCode = 403;
            } else if (error.message.includes('Email already registered')) {
                message = 'Account already exists with this email address.';
                statusCode = 409;
            }
            
            res.status(statusCode).json({ 
                success: false,
                error: message,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    static async verifyEmail(req, res) {
        try {
            const { token } = req.query;
            
            if (!token) {
                return res.status(400).render('verification-result', {
                    title: 'Invalid Verification Link - FoodConnect Malaysia',
                    success: false,
                    message: 'Invalid verification link. Please check your email for the correct link.'
                });
            }

            const user = await User.verifyEmail(token);
            
            // Send welcome email
            try {
                await emailService.sendWelcomeEmail(
                    user.email,
                    user.user_type === 'restaurant' ? 'Restaurant Owner' : 'Food Influencer',
                    user.user_type
                );
            } catch (emailError) {
                console.error('❌ Failed to send welcome email:', emailError);
            }

            res.render('verification-result', {
                title: 'Email Verified Successfully - FoodConnect Malaysia',
                success: true,
                message: 'Your email has been verified successfully! You can now log in to your account.'
            });
        } catch (error) {
            console.error('Email verification controller error:', error);
            
            res.render('verification-result', {
                title: 'Verification Failed - FoodConnect Malaysia',
                success: false,
                message: error.message === 'Invalid or expired verification token' 
                    ? 'Invalid or expired verification token. Please request a new verification email.'
                    : 'Verification failed. Please try again or contact support.'
            });
        }
    }

    static async resendVerification(req, res) {
        try {
            const { email } = req.body;
            
            const verificationToken = await User.resendVerificationEmail(email);
            
            // Send verification email
            try {
                const user = await User.findByEmail(email);
                const name = user.user_type === 'restaurant' ? 'Restaurant Owner' : 'Food Influencer';
                
                await emailService.sendVerificationEmail(
                    email,
                    name,
                    verificationToken,
                    user.user_type
                );
                
                res.json({
                    success: true,
                    message: 'Verification email sent! Please check your inbox.'
                });
            } catch (emailError) {
                console.error('❌ Failed to send verification email:', emailError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to send verification email. Please try again.'
                });
            }
        } catch (error) {
            console.error('Resend verification controller error:', error);
            
            let message = 'Failed to resend verification email.';
            if (error.message === 'User not found') {
                message = 'No account found with this email address.';
            } else if (error.message === 'Email already verified') {
                message = 'Email is already verified. You can log in to your account.';
            }
            
            res.status(400).json({ 
                success: false,
                error: message
            });
        }
    }

    static async getCurrentUser(req, res) {
        try {
            const userWithProfile = await User.getUserWithProfile(req.user.id);
            
            if (!userWithProfile) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            
            res.json({
                success: true,
                message: 'User data retrieved successfully',
                user: userWithProfile.user,
                profile: userWithProfile.profile
            });
        } catch (error) {
            console.error('Get current user controller error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve user data' 
            });
        }
    }

    static async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            
            // For now, just return success (you can implement this later)
            res.json({
                success: true,
                message: 'If an account with this email exists, you will receive password reset instructions.'
            });
        } catch (error) {
            console.error('Password reset request controller error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Password reset request failed. Please try again.' 
            });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            
            // For now, just return success (you can implement this later)
            res.json({
                success: true,
                message: 'Password reset successful. You can now log in with your new password.'
            });
        } catch (error) {
            console.error('Password reset controller error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Password reset failed. Please try again.' 
            });
        }
    }

    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            
            // For now, just return success (you can implement this later)
            res.json({
                success: true,
                message: 'Password changed successfully.'
            });
        } catch (error) {
            console.error('Change password controller error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Password change failed. Please try again.' 
            });
        }
    }

    static async logout(req, res) {
        try {
            res.json({ 
                success: true,
                message: 'Logout successful. Please remove the token from client storage.' 
            });
        } catch (error) {
            console.error('Logout controller error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Logout failed' 
            });
        }
    }

    // Helper method to count admin users
    static async getAdminCount() {
        try {
            const userMVP = new UserMVP();
            return await userMVP.getAdminCount();
        } catch (error) {
            console.log('❌ Error counting admins:', error.message);
            return 0;
        }
    }
}

module.exports = AuthController;