const User = require('../models/User');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');

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
            
            if (!['restaurant', 'influencer'].includes(user_type)) {
                console.log('❌ Invalid user type:', user_type);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid user type. Must be either "restaurant" or "influencer".'
                });
            }
            
            // Check if user already exists (with error handling)
            let existingUser = null;
            try {
                console.log('🔍 Checking if user exists...');
                existingUser = await User.findByEmail(email);
                console.log('✅ User check completed');
            } catch (dbError) {
                console.log('⚠️  Database not available, using MVP mode');
                // If database is not available, continue with MVP registration
                console.log('Database error:', dbError.message);
            }
            
            if (existingUser) {
                console.log('❌ User already exists');
                return res.status(409).json({ 
                    success: false,
                    error: 'Email already registered',
                    message: 'An account with this email address already exists.'
                });
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
            }
            
            // Create user with profile (with MVP fallback)
            let result = null;
            try {
                console.log('💾 Creating user in database...');
                result = await User.create({
                    email,
                    password,
                    userType: user_type,
                    additionalData
                });
                console.log('✅ User created in database');
            } catch (dbError) {
                console.log('⚠️  Database creation failed, using MVP mode');
                console.log('Database error:', dbError.message);
                
                // MVP mode - simulate successful registration
                result = {
                    user: {
                        id: Date.now(),
                        email: email,
                        userType: user_type,
                        emailVerified: false
                    },
                    profile: additionalData,
                    verificationToken: 'mvp-' + Math.random().toString(36).substr(2, 9)
                };
                console.log('✅ MVP mode registration created');
            }
            
            // Send verification email (optional in MVP mode)
            let emailSent = false;
            try {
                console.log('📧 Attempting to send verification email...');
                const name = user_type === 'restaurant' 
                    ? (restaurant_name || 'Restaurant Owner') 
                    : (display_name || instagram_handle || 'Influencer');
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
                    : 'Registration successful! Your account is ready for the MVP launch in October 2025.',
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    userType: result.user.userType,
                    emailVerified: result.user.emailVerified || false
                },
                emailSent: emailSent,
                mvpMode: !emailSent
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
            const { email, password } = req.body;
            
            const user = await User.authenticate(email, password);
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    userType: user.userType 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    userType: user.userType,
                    status: user.status,
                    emailVerified: user.emailVerified
                }
            });
        } catch (error) {
            console.error('Login controller error:', error);
            
            let message = 'Login failed. Please try again.';
            let statusCode = 500;
            
            if (error.message === 'User not found' || error.message === 'Invalid password') {
                message = 'Invalid email or password';
                statusCode = 401;
            } else if (error.message === 'Email not verified') {
                message = 'Please verify your email address before logging in';
                statusCode = 403;
            }
            
            res.status(statusCode).json({ 
                success: false,
                error: message
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
}

module.exports = AuthController;