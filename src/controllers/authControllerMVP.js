const UserMVP = require('../models/UserMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const emailService = require('../services/emailServiceMVP');
const { body, validationResult } = require('express-validator');

class AuthControllerMVP {
    // Registration validation rules
    static getRegistrationValidation() {
        return [
            body('email')
                .isEmail()
                .normalizeEmail()
                .withMessage('Please provide a valid email address'),
            body('password')
                .isLength({ min: 6 })
                .withMessage('Password must be at least 6 characters long'),
            body('user_type')
                .isIn(['restaurant', 'influencer'])
                .withMessage('User type must be either restaurant or influencer'),
            // Restaurant validation
            body('business_name')
                .if(body('user_type').equals('restaurant'))
                .notEmpty()
                .withMessage('Business name is required for restaurants'),
            body('address')
                .if(body('user_type').equals('restaurant'))
                .notEmpty()
                .withMessage('Address is required for restaurants'),
            body('city')
                .if(body('user_type').equals('restaurant'))
                .notEmpty()
                .withMessage('City is required for restaurants'),
            body('state')
                .if(body('user_type').equals('restaurant'))
                .isIn(RestaurantMVP.getMalaysianStates())
                .withMessage('Please select a valid Malaysian state'),
            // Influencer validation
            body('display_name')
                .if(body('user_type').equals('influencer'))
                .notEmpty()
                .withMessage('Display name is required for influencers'),
            body('location')
                .if(body('user_type').equals('influencer'))
                .notEmpty()
                .withMessage('Location is required for influencers'),
            body('city')
                .if(body('user_type').equals('influencer'))
                .notEmpty()
                .withMessage('City is required for influencers'),
            body('state')
                .if(body('user_type').equals('influencer'))
                .isIn(InfluencerMVP.getMalaysianStates())
                .withMessage('Please select a valid Malaysian state')
        ];
    }

    // User registration
    static async register(req, res) {
        try {
            console.log('🔄 MVP Registration attempt started');
            console.log('Request body:', { ...req.body, password: '[HIDDEN]' });

            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('❌ Validation errors:', errors.array());
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userModel = new UserMVP();
            const { email, password, user_type } = req.body;

            // Check if user already exists
            const existingUser = await userModel.findByEmail(email);
            if (existingUser) {
                console.log('❌ User already exists:', email);
                return res.status(400).json({
                    success: false,
                    error: 'An account with this email already exists. Please try logging in instead.'
                });
            }

            // Create user account
            const { user, verificationToken } = await userModel.create({
                email,
                password,
                userType: user_type
            });

            console.log('✅ User created successfully:', user.id);

            // Create profile based on user type
            let profile = null;
            if (user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const restaurantData = {
                    user_id: user.id,
                    business_name: req.body.business_name,
                    description: req.body.description || null,
                    phone: req.body.phone || null,
                    address: req.body.address,
                    google_maps_link: req.body.google_maps_link || null,
                    dietary_categories: req.body.dietary_categories || [],
                    city: req.body.city,
                    state: req.body.state,
                    website: req.body.website || null
                };

                profile = await restaurantModel.create(restaurantData);
                console.log('✅ Restaurant profile created:', profile.id);

            } else if (user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencerData = {
                    user_id: user.id,
                    display_name: req.body.display_name,
                    phone: req.body.phone || null,
                    bio: req.body.bio || null,
                    location: req.body.location,
                    city: req.body.city,
                    state: req.body.state,
                    instagram_username: req.body.instagram_username || null,
                    instagram_link: req.body.instagram_link || null,
                    instagram_followers: 0,
                    tiktok_username: req.body.tiktok_username || null,
                    tiktok_link: req.body.tiktok_link || null,
                    tiktok_followers: 0,
                    xhs_username: req.body.xhs_username || null,
                    xhs_link: req.body.xhs_link || null,
                    xhs_followers: 0,
                    youtube_channel: req.body.youtube_channel || null,
                    youtube_followers: 0
                };

                profile = await influencerModel.create(influencerData);
                console.log('✅ Influencer profile created:', profile.id);
            }

            // Send verification email
            try {
                await emailService.sendVerificationEmail(user.email, verificationToken, user.user_type);
                console.log('✅ Verification email sent to:', user.email);
            } catch (emailError) {
                console.error('⚠️ Failed to send verification email:', emailError.message);
                // Continue with registration even if email fails
            }

            // Log successful registration
            console.log(`🎉 ${user_type} registration completed:`, {
                userId: user.id,
                email: user.email,
                profileId: profile?.id
            });

            res.status(201).json({
                success: true,
                message: `${user_type === 'restaurant' ? 'Restaurant' : 'Influencer'} registration successful! Please check your email to verify your account.`,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        user_type: user.user_type,
                        status: user.status,
                        email_verified: user.email_verified
                    },
                    profile: profile
                },
                next_steps: [
                    'Check your email and click the verification link',
                    'Wait for admin approval',
                    'You will receive an email once your account is approved'
                ]
            });

        } catch (error) {
            console.error('❌ Registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Registration failed. Please try again.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // User login
    static async login(req, res) {
        try {
            console.log('🔄 Login attempt started');
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            const userModel = new UserMVP();
            const user = await userModel.authenticate(email, password);

            if (!user) {
                console.log('❌ Authentication failed for:', email);
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password'
                });
            }

            // Check account status
            if (user.status === 'pending') {
                return res.status(403).json({
                    success: false,
                    error: 'Your account is pending approval. Please wait for admin approval.',
                    status: 'pending_approval'
                });
            }

            if (user.status === 'rejected') {
                return res.status(403).json({
                    success: false,
                    error: 'Your account has been rejected. Please contact support for more information.',
                    status: 'rejected'
                });
            }

            if (user.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    error: 'Your account has been suspended. Please contact support.',
                    status: 'suspended'
                });
            }

            // Generate JWT token
            const token = userModel.generateJWT(user);

            // Get user profile
            let profile = null;
            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                profile = await restaurantModel.findByUserId(user.id);
            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                profile = await influencerModel.findByUserId(user.id);
            }

            console.log('✅ Login successful for:', email);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        user_type: user.user_type,
                        status: user.status,
                        email_verified: user.email_verified
                    },
                    profile
                }
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Login failed. Please try again.'
            });
        }
    }

    // Email verification
    static async verifyEmail(req, res) {
        try {
            const { token } = req.params;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification token is required'
                });
            }

            const userModel = new UserMVP();
            const user = await userModel.verifyEmail(token);

            console.log('✅ Email verified for user:', user.id);

            res.json({
                success: true,
                message: 'Email verified successfully! Your account is now pending admin approval.',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        user_type: user.user_type,
                        status: user.status,
                        email_verified: user.email_verified
                    }
                }
            });

        } catch (error) {
            console.error('❌ Email verification error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Email verification failed'
            });
        }
    }

    // Request password reset
    static async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            const userModel = new UserMVP();
            const { user, resetToken } = await userModel.createPasswordResetToken(email);

            // Send password reset email
            try {
                await emailService.sendPasswordResetEmail(user.email, resetToken);
                console.log('✅ Password reset email sent to:', user.email);
            } catch (emailError) {
                console.error('⚠️ Failed to send password reset email:', emailError.message);
                throw new Error('Failed to send password reset email. Please try again.');
            }

            res.json({
                success: true,
                message: 'Password reset instructions have been sent to your email address.'
            });

        } catch (error) {
            console.error('❌ Password reset request error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process password reset request'
            });
        }
    }

    // Reset password
    static async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;

            if (!token || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Reset token and new password are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters long'
                });
            }

            const userModel = new UserMVP();
            const user = await userModel.resetPassword(token, password);

            console.log('✅ Password reset successful for user:', user.id);

            res.json({
                success: true,
                message: 'Password reset successful! You can now log in with your new password.'
            });

        } catch (error) {
            console.error('❌ Password reset error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Password reset failed'
            });
        }
    }

    // Get current user profile
    static async getProfile(req, res) {
        try {
            const userModel = new UserMVP();
            const user = await userModel.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Get profile based on user type
            let profile = null;
            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                profile = await restaurantModel.findByUserId(user.id);
            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                profile = await influencerModel.findByUserId(user.id);
            }

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        user_type: user.user_type,
                        status: user.status,
                        email_verified: user.email_verified,
                        last_login: user.last_login,
                        created_at: user.created_at
                    },
                    profile
                }
            });

        } catch (error) {
            console.error('❌ Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user profile'
            });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        try {
            const user = req.user;
            let updatedProfile = null;

            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const currentProfile = await restaurantModel.findByUserId(user.id);

                if (!currentProfile) {
                    return res.status(404).json({
                        success: false,
                        error: 'Restaurant profile not found'
                    });
                }

                const updateData = {};
                const allowedFields = [
                    'business_name', 'description', 'phone', 'address', 'google_maps_link',
                    'dietary_categories', 'city', 'state', 'website'
                ];

                allowedFields.forEach(field => {
                    if (req.body[field] !== undefined) {
                        updateData[field] = req.body[field];
                    }
                });

                updatedProfile = await restaurantModel.update(currentProfile.id, updateData);

            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const currentProfile = await influencerModel.findByUserId(user.id);

                if (!currentProfile) {
                    return res.status(404).json({
                        success: false,
                        error: 'Influencer profile not found'
                    });
                }

                const updateData = {};
                const allowedFields = [
                    'display_name', 'phone', 'bio', 'location', 'city', 'state',
                    'instagram_username', 'instagram_link', 'tiktok_username', 'tiktok_link',
                    'xhs_username', 'xhs_link', 'youtube_channel'
                ];

                allowedFields.forEach(field => {
                    if (req.body[field] !== undefined) {
                        updateData[field] = req.body[field];
                    }
                });

                updatedProfile = await influencerModel.update(currentProfile.id, updateData);
            }

            console.log('✅ Profile updated for user:', user.id);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    profile: updatedProfile
                }
            });

        } catch (error) {
            console.error('❌ Update profile error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update profile'
            });
        }
    }

    // Logout (client-side token invalidation)
    static async logout(req, res) {
        res.json({
            success: true,
            message: 'Logout successful. Please remove the token from client storage.'
        });
    }

    // Get registration form data
    static async getRegistrationData(req, res) {
        res.json({
            success: true,
            data: {
                malaysian_states: RestaurantMVP.getMalaysianStates(),
                dietary_categories: RestaurantMVP.getDietaryCategories(),
                influencer_tiers: InfluencerMVP.getTierLabels()
            }
        });
    }

    // Authentication middleware for routes
    static async requireAuth(req, res, next) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token && req.session && req.session.user) {
                req.user = req.session.user;
                return next();
            }

            if (!token) {
                if (req.accepts('json')) {
                    return res.status(401).json({ error: 'Access token required' });
                } else {
                    req.flash('error', 'Please log in to access this page');
                    return res.redirect('/auth/login');
                }
            }

            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

            const userModel = new UserMVP();
            const user = await userModel.findById(decoded.id);

            if (!user) {
                return res.status(401).json({ error: 'Invalid token' });
            }

            if (user.status !== 'approved' && user.status !== 'active' && user.user_type !== 'admin') {
                return res.status(403).json({
                    error: 'Account not approved',
                    status: user.status
                });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            if (req.accepts('json')) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            } else {
                req.flash('error', 'Session expired. Please log in again.');
                return res.redirect('/auth/login');
            }
        }
    }

    // Role-based access control
    static requireRole(requiredRole) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (req.user.user_type !== requiredRole) {
                return res.status(403).json({
                    error: `Access denied. ${requiredRole} role required.`
                });
            }

            next();
        };
    }

    // Optional authentication (doesn't require login)
    static async optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (req.session && req.session.user) {
                req.user = req.session.user;
                return next();
            }

            if (!token) {
                return next();
            }

            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

            const userModel = new UserMVP();
            const user = await userModel.findById(decoded.id);

            if (user && (user.status === 'approved' || user.status === 'active' || user.user_type === 'admin')) {
                req.user = user;
            }
        } catch (error) {
            console.error('Optional auth error:', error);
        }

        next();
    }
}

module.exports = AuthControllerMVP;