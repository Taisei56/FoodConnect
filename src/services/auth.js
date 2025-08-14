const bcrypt = require('bcryptjs');
const { generateToken, verifyToken } = require('../config/jwt');
const { User, Restaurant, Influencer } = require('../models');
const { sendWelcomeEmail } = require('../config/email');
const { query } = require('../config/database');

class AuthService {
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    static async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    static async register({ 
        email, 
        password, 
        user_type, 
        restaurant_name, 
        google_maps, 
        instagram_handle, 
        tiktok_handle, 
        facebook_page, 
        xiaohongshu_handle 
    }) {
        try {
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new Error('Email already registered');
            }

            const hashedPassword = await this.hashPassword(password);
            
            const user = await User.create({
                email,
                password_hash: hashedPassword,
                user_type,
                restaurant_name,
                google_maps,
                instagram_handle,
                tiktok_handle,
                facebook_page,
                xiaohongshu_handle
            });

            await sendWelcomeEmail(email, email.split('@')[0], user_type);

            return {
                id: user.id,
                email: user.email,
                user_type: user.user_type,
                status: user.status,
                created_at: user.created_at
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    static async login({ email, password }) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('Invalid email or password');
            }

            const isValidPassword = await this.comparePassword(password, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Invalid email or password');
            }

            if (user.status === 'rejected') {
                throw new Error('Account has been rejected');
            }

            if (user.status === 'suspended') {
                throw new Error('Account has been suspended');
            }

            const token = generateToken({ 
                userId: user.id, 
                email: user.email, 
                user_type: user.user_type 
            });

            let profile = null;
            if (user.user_type === 'restaurant') {
                profile = await Restaurant.findByUserId(user.id);
            } else if (user.user_type === 'influencer') {
                profile = await Influencer.findByUserId(user.id);
            }

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    user_type: user.user_type,
                    status: user.status,
                    created_at: user.created_at
                },
                profile,
                needsProfile: !profile && user.status === 'approved'
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    static async requestPasswordReset(email) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                return { message: 'If an account with that email exists, a reset link has been sent' };
            }

            const resetToken = generateToken({ 
                userId: user.id, 
                type: 'password_reset' 
            });

            return { 
                message: 'If an account with that email exists, a reset link has been sent',
                resetToken
            };
        } catch (error) {
            console.error('Password reset request error:', error);
            throw error;
        }
    }

    static async resetPassword({ token, newPassword }) {
        try {
            const decoded = verifyToken(token);
            
            if (decoded.type !== 'password_reset') {
                throw new Error('Invalid reset token');
            }

            const hashedPassword = await this.hashPassword(newPassword);
            
            const result = await query(
                'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
                [hashedPassword, decoded.userId]
            );

            if (result.rows.length === 0) {
                throw new Error('Invalid reset token');
            }

            return { message: 'Password reset successfully' };
        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }

    static async getCurrentUser(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let profile = null;
            if (user.user_type === 'restaurant') {
                profile = await Restaurant.findByUserId(user.id);
            } else if (user.user_type === 'influencer') {
                profile = await Influencer.findByUserId(user.id);
            }

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    user_type: user.user_type,
                    status: user.status,
                    created_at: user.created_at
                },
                profile,
                needsProfile: !profile && user.status === 'approved'
            };
        } catch (error) {
            console.error('Get current user error:', error);
            throw error;
        }
    }

    static async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const isValidPassword = await this.comparePassword(currentPassword, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }

            const hashedPassword = await this.hashPassword(newPassword);
            
            await query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [hashedPassword, userId]
            );

            return { message: 'Password changed successfully' };
        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    }
}

module.exports = AuthService;