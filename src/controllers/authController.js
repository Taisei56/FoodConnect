const AuthService = require('../services/auth');

class AuthController {
    static async register(req, res) {
        try {
            const { 
                email, 
                password, 
                user_type,
                // Restaurant fields
                restaurant_name,
                google_maps,
                // Influencer fields
                instagram_handle,
                tiktok_handle,
                facebook_page,
                xiaohongshu_handle
            } = req.body;
            
            const user = await AuthService.register({
                email,
                password,
                user_type,
                restaurant_name,
                google_maps,
                instagram_handle,
                tiktok_handle,
                facebook_page,
                xiaohongshu_handle
            });

            res.status(201).json({
                message: 'Registration successful! Your account has been created and your credentials are safely stored. Our MVP will launch in October 2025 with full platform access. You will receive an email notification when we go live.',
                user,
                launchDate: 'October 2025'
            });
        } catch (error) {
            console.error('Registration controller error:', error);
            
            if (error.message === 'Email already registered') {
                return res.status(409).json({ error: error.message });
            }
            
            res.status(500).json({ 
                error: 'Registration failed. Please try again.' 
            });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            const result = await AuthService.login({ email, password });

            // Allow login but redirect to MVP coming soon dashboard
            if (result.user.status === 'pending') {
                return res.status(403).json({
                    error: 'Account pending approval',
                    message: 'Your account is still under review. You will receive an email once approved.'
                });
            }

            res.json({
                message: 'Login successful - Welcome to FoodConnect MVP Preview',
                ...result,
                mvpPreview: true,
                launchDate: 'October 2025'
            });
        } catch (error) {
            console.error('Login controller error:', error);
            
            if (error.message.includes('Invalid email or password')) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            
            if (error.message.includes('rejected')) {
                return res.status(403).json({ 
                    error: 'Account has been rejected',
                    message: 'Your account application was not approved. Please contact support if you believe this is an error.'
                });
            }
            
            if (error.message.includes('suspended')) {
                return res.status(403).json({ 
                    error: 'Account suspended',
                    message: 'Your account has been suspended. Please contact support for more information.'
                });
            }
            
            res.status(500).json({ 
                error: 'Login failed. Please try again.' 
            });
        }
    }

    static async getCurrentUser(req, res) {
        try {
            const result = await AuthService.getCurrentUser(req.user.id);
            
            res.json({
                message: 'User data retrieved successfully',
                ...result
            });
        } catch (error) {
            console.error('Get current user controller error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve user data' 
            });
        }
    }

    static async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            
            const result = await AuthService.requestPasswordReset(email);
            
            res.json(result);
        } catch (error) {
            console.error('Password reset request controller error:', error);
            res.status(500).json({ 
                error: 'Password reset request failed. Please try again.' 
            });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            
            const result = await AuthService.resetPassword({ token, newPassword });
            
            res.json(result);
        } catch (error) {
            console.error('Password reset controller error:', error);
            
            if (error.message.includes('Invalid reset token')) {
                return res.status(400).json({ 
                    error: 'Invalid or expired reset token' 
                });
            }
            
            res.status(500).json({ 
                error: 'Password reset failed. Please try again.' 
            });
        }
    }

    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            
            const result = await AuthService.changePassword(
                req.user.id, 
                currentPassword, 
                newPassword
            );
            
            res.json(result);
        } catch (error) {
            console.error('Change password controller error:', error);
            
            if (error.message.includes('Current password is incorrect')) {
                return res.status(400).json({ error: error.message });
            }
            
            res.status(500).json({ 
                error: 'Password change failed. Please try again.' 
            });
        }
    }

    static async logout(req, res) {
        try {
            res.json({ 
                message: 'Logout successful. Please remove the token from client storage.' 
            });
        } catch (error) {
            console.error('Logout controller error:', error);
            res.status(500).json({ 
                error: 'Logout failed' 
            });
        }
    }
}

module.exports = AuthController;