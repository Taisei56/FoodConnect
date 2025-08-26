const db = require('../config/database');
const User = require('../models/User');

class AdminController {
    // Show admin dashboard
    async dashboard(req, res) {
        try {
            // Simple admin check - you can enhance this with proper admin roles
            const user = await User.findById(req.user.id);
            
            // For now, allow access if user is verified
            // In production, you'd want proper admin role checking
            if (!user || !user.email_verified) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'Admin access required'
                });
            }
            
            res.render('admin/dashboard', {
                title: 'Admin Dashboard - FoodConnect Malaysia',
                user: req.user
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Server error'
            });
        }
    }
    
    // Get admin statistics
    async getStats(req, res) {
        try {
            const stats = await this.calculateStats();
            res.json(stats);
        } catch (error) {
            console.error('Admin stats error:', error);
            res.status(500).json({ error: 'Failed to load statistics' });
        }
    }
    
    // Get all users with their profiles
    async getUsers(req, res) {
        try {
            const result = await db.query(`
                SELECT 
                    u.id,
                    u.email,
                    u.user_type,
                    u.status,
                    u.email_verified,
                    u.created_at,
                    CASE 
                        WHEN u.user_type = 'restaurant' THEN r.business_name
                        WHEN u.user_type = 'influencer' THEN i.display_name
                        ELSE NULL
                    END as profile_name
                FROM users u
                LEFT JOIN restaurants r ON u.id = r.user_id
                LEFT JOIN influencers i ON u.id = i.user_id
                ORDER BY u.created_at DESC
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Admin get users error:', error);
            res.status(500).json({ error: 'Failed to load users' });
        }
    }
    
    // Get user details by ID
    async getUserDetails(req, res) {
        try {
            const userId = req.params.id;
            const userWithProfile = await User.getUserWithProfile(userId);
            
            if (!userWithProfile) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json(userWithProfile);
        } catch (error) {
            console.error('Admin get user details error:', error);
            res.status(500).json({ error: 'Failed to load user details' });
        }
    }
    
    // Calculate dashboard statistics
    async calculateStats() {
        try {
            // Get total users
            const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
            const totalUsers = parseInt(totalUsersResult.rows[0].count);
            
            // Get restaurants count
            const restaurantsResult = await db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'restaurant'");
            const totalRestaurants = parseInt(restaurantsResult.rows[0].count);
            
            // Get influencers count
            const influencersResult = await db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'influencer'");
            const totalInfluencers = parseInt(influencersResult.rows[0].count);
            
            // Get pending verifications
            const pendingResult = await db.query('SELECT COUNT(*) as count FROM users WHERE email_verified = false');
            const pendingVerifications = parseInt(pendingResult.rows[0].count);
            
            return {
                totalUsers,
                totalRestaurants,
                totalInfluencers,
                pendingVerifications
            };
        } catch (error) {
            console.error('Error calculating stats:', error);
            return {
                totalUsers: 0,
                totalRestaurants: 0,
                totalInfluencers: 0,
                pendingVerifications: 0
            };
        }
    }
    
    // Export users data as CSV
    async exportUsers(req, res) {
        try {
            const result = await db.query(`
                SELECT 
                    u.id,
                    u.email,
                    u.user_type,
                    u.status,
                    u.email_verified,
                    u.created_at,
                    CASE 
                        WHEN u.user_type = 'restaurant' THEN r.business_name
                        WHEN u.user_type = 'influencer' THEN i.display_name
                        ELSE ''
                    END as profile_name,
                    CASE 
                        WHEN u.user_type = 'restaurant' THEN r.location
                        WHEN u.user_type = 'influencer' THEN i.location
                        ELSE ''
                    END as location
                FROM users u
                LEFT JOIN restaurants r ON u.id = r.user_id
                LEFT JOIN influencers i ON u.id = i.user_id
                ORDER BY u.created_at DESC
            `);
            
            // Convert to CSV
            const headers = ['ID', 'Email', 'Type', 'Profile Name', 'Location', 'Status', 'Verified', 'Registered'];
            let csv = headers.join(',') + '\n';
            
            result.rows.forEach(row => {
                const csvRow = [
                    row.id,
                    '"' + row.email + '"',
                    row.user_type,
                    '"' + (row.profile_name || '') + '"',
                    '"' + (row.location || '') + '"',
                    row.status,
                    row.email_verified ? 'Yes' : 'No',
                    new Date(row.created_at).toLocaleDateString()
                ];
                csv += csvRow.join(',') + '\n';
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="foodconnect_users.csv"');
            res.send(csv);
            
        } catch (error) {
            console.error('Admin export users error:', error);
            res.status(500).json({ error: 'Failed to export users' });
        }
    }
}

module.exports = new AdminController();