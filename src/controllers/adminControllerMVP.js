const UserMVP = require('../models/UserMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const CampaignMVP = require('../models/CampaignMVP');
const emailService = require('../services/emailService');

class AdminControllerMVP {
    // Admin dashboard with stats
    static async getDashboard(req, res) {
        try {
            const userModel = new UserMVP();
            const restaurantModel = new RestaurantMVP();
            const influencerModel = new InfluencerMVP();
            const campaignModel = new CampaignMVP();

            // Get all statistics
            const [userStats, restaurantStats, influencerStats, campaignStats] = await Promise.all([
                userModel.getStats(),
                restaurantModel.getStats(),
                influencerModel.getStats(),
                campaignModel.getStats()
            ]);

            // Get pending approvals count
            const pendingUsers = await userModel.findAll({ status: 'pending' });
            const pendingFollowerUpdates = await influencerModel.getFollowerUpdateRequests({ status: 'pending' });

            const dashboardData = {
                overview: {
                    total_users: userStats.total,
                    total_restaurants: restaurantStats.total,
                    total_influencers: influencerStats.total,
                    total_campaigns: campaignStats.total,
                    pending_approvals: pendingUsers.length,
                    pending_follower_updates: pendingFollowerUpdates.length
                },
                user_statistics: userStats,
                restaurant_statistics: restaurantStats,
                influencer_statistics: influencerStats,
                campaign_statistics: campaignStats,
                recent_activity: {
                    recent_registrations: userStats.recent_registrations,
                    recent_campaigns: campaignStats.recent_campaigns
                }
            };

            res.json({
                success: true,
                data: dashboardData
            });

        } catch (error) {
            console.error('❌ Admin dashboard error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load dashboard data'
            });
        }
    }

    // Get all pending approvals
    static async getPendingApprovals(req, res) {
        try {
            const userModel = new UserMVP();
            const restaurantModel = new RestaurantMVP();
            const influencerModel = new InfluencerMVP();

            // Get pending users with their profiles
            const pendingUsers = await userModel.findAll({ status: 'pending' });

            const pendingApprovals = await Promise.all(
                pendingUsers.map(async (user) => {
                    let profile = null;
                    if (user.user_type === 'restaurant') {
                        profile = await restaurantModel.findByUserId(user.id);
                    } else if (user.user_type === 'influencer') {
                        profile = await influencerModel.findByUserId(user.id);
                    }

                    return {
                        user,
                        profile,
                        type: user.user_type
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    pending_approvals: pendingApprovals,
                    total_count: pendingApprovals.length
                }
            });

        } catch (error) {
            console.error('❌ Get pending approvals error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending approvals'
            });
        }
    }

    // Approve or reject user registration
    static async processUserApproval(req, res) {
        try {
            const { userId } = req.params;
            const { action, notes } = req.body; // action: 'approve' or 'reject'
            const adminId = req.user.id;

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be either approve or reject'
                });
            }

            const userModel = new UserMVP();
            const user = await userModel.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            if (user.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'User is not pending approval'
                });
            }

            // Update user status
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const updatedUser = await userModel.updateStatus(userId, newStatus);

            // Add admin notes to profile
            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const profile = await restaurantModel.findByUserId(user.id);
                if (profile) {
                    await restaurantModel.addAdminNotes(profile.id, notes, adminId);
                }
            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const profile = await influencerModel.findByUserId(user.id);
                if (profile) {
                    await influencerModel.addAdminNotes(profile.id, notes, adminId);
                }
            }

            // Send notification email
            try {
                if (action === 'approve') {
                    await emailService.sendApprovalEmail(user.email, user.user_type);
                } else {
                    await emailService.sendRejectionEmail(user.email, user.user_type, notes);
                }
                console.log(`✅ ${action} notification email sent to:`, user.email);
            } catch (emailError) {
                console.error('⚠️ Failed to send notification email:', emailError.message);
            }

            console.log(`✅ User ${action}d:`, {
                userId: user.id,
                email: user.email,
                userType: user.user_type,
                adminId
            });

            res.json({
                success: true,
                message: `User ${action}d successfully`,
                data: {
                    user: updatedUser,
                    action,
                    admin_notes: notes
                }
            });

        } catch (error) {
            console.error('❌ Process user approval error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process user approval'
            });
        }
    }

    // Get all users with filters
    static async getUsers(req, res) {
        try {
            const {
                user_type,
                status,
                page = 1,
                limit = 20,
                search
            } = req.query;

            const userModel = new UserMVP();
            const filters = {};

            if (user_type) filters.user_type = user_type;
            if (status) filters.status = status;

            let users = await userModel.findAll(filters);

            // Search functionality
            if (search) {
                const searchLower = search.toLowerCase();
                users = users.filter(user =>
                    user.email.toLowerCase().includes(searchLower)
                );
            }

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedUsers = users.slice(startIndex, endIndex);

            // Get profiles for users
            const usersWithProfiles = await Promise.all(
                paginatedUsers.map(async (user) => {
                    let profile = null;
                    if (user.user_type === 'restaurant') {
                        const restaurantModel = new RestaurantMVP();
                        profile = await restaurantModel.findByUserId(user.id);
                    } else if (user.user_type === 'influencer') {
                        const influencerModel = new InfluencerMVP();
                        profile = await influencerModel.findByUserId(user.id);
                    }

                    return {
                        ...user,
                        profile
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    users: usersWithProfiles,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: users.length,
                        total_pages: Math.ceil(users.length / limit)
                    },
                    filters: {
                        user_type,
                        status,
                        search
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get users error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get users'
            });
        }
    }

    // Get follower update requests
    static async getFollowerUpdateRequests(req, res) {
        try {
            const { status = 'pending' } = req.query;
            const influencerModel = new InfluencerMVP();

            const updateRequests = await influencerModel.getFollowerUpdateRequests({ status });

            res.json({
                success: true,
                data: {
                    update_requests: updateRequests,
                    total_count: updateRequests.length
                }
            });

        } catch (error) {
            console.error('❌ Get follower update requests error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get follower update requests'
            });
        }
    }

    // Process follower update request
    static async processFollowerUpdate(req, res) {
        try {
            const { updateId } = req.params;
            const { action, notes } = req.body; // action: 'approve' or 'reject'
            const adminId = req.user.id;

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be either approve or reject'
                });
            }

            const influencerModel = new InfluencerMVP();
            const updatedRequest = await influencerModel.processFollowerUpdate(
                updateId,
                action === 'approve' ? 'approved' : 'rejected',
                notes,
                adminId
            );

            console.log(`✅ Follower update ${action}d:`, {
                updateId,
                influencerId: updatedRequest.influencer_id,
                platform: updatedRequest.platform,
                adminId
            });

            res.json({
                success: true,
                message: `Follower update request ${action}d successfully`,
                data: updatedRequest
            });

        } catch (error) {
            console.error('❌ Process follower update error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process follower update'
            });
        }
    }

    // Get all campaigns
    static async getCampaigns(req, res) {
        try {
            const {
                status,
                restaurant_id,
                page = 1,
                limit = 20
            } = req.query;

            const campaignModel = new CampaignMVP();
            const filters = {};

            if (status) filters.status = status;
            if (restaurant_id) filters.restaurant_id = restaurant_id;

            const campaigns = await campaignModel.findAll(filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedCampaigns = campaigns.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    campaigns: paginatedCampaigns,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: campaigns.length,
                        total_pages: Math.ceil(campaigns.length / limit)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get campaigns error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get campaigns'
            });
        }
    }

    // Update user status (suspend/activate)
    static async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status, reason } = req.body;

            const validStatuses = ['active', 'suspended', 'approved'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status. Must be one of: active, suspended, approved'
                });
            }

            const userModel = new UserMVP();
            const updatedUser = await userModel.updateStatus(userId, status);

            // Send notification email for suspension
            if (status === 'suspended') {
                try {
                    await emailService.sendSuspensionEmail(updatedUser.email, reason);
                    console.log('✅ Suspension notification sent to:', updatedUser.email);
                } catch (emailError) {
                    console.error('⚠️ Failed to send suspension email:', emailError.message);
                }
            }

            console.log(`✅ User status updated:`, {
                userId,
                newStatus: status,
                reason,
                adminId: req.user.id
            });

            res.json({
                success: true,
                message: `User status updated to ${status}`,
                data: updatedUser
            });

        } catch (error) {
            console.error('❌ Update user status error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update user status'
            });
        }
    }

    // Get platform settings
    static async getPlatformSettings(req, res) {
        try {
            // This would normally come from database, for now return defaults
            const settings = {
                platform_fee_percentage: 15.0,
                min_campaign_budget: 100.0,
                max_campaign_duration_days: 60,
                auto_approve_restaurants: false,
                auto_approve_influencers: false,
                touch_n_go_business_account: process.env.TOUCH_N_GO_ACCOUNT || '',
                admin_email: process.env.ADMIN_EMAIL || 'admin@foodconnect.my',
                site_maintenance_mode: false
            };

            res.json({
                success: true,
                data: { settings }
            });

        } catch (error) {
            console.error('❌ Get platform settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get platform settings'
            });
        }
    }

    // Update platform settings
    static async updatePlatformSettings(req, res) {
        try {
            const { settings } = req.body;

            // In a real implementation, this would update the database
            // For now, we'll just validate and return success
            console.log('✅ Platform settings updated by admin:', req.user.id);

            res.json({
                success: true,
                message: 'Platform settings updated successfully',
                data: { settings }
            });

        } catch (error) {
            console.error('❌ Update platform settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update platform settings'
            });
        }
    }

    // Get activity logs (placeholder)
    static async getActivityLogs(req, res) {
        try {
            const { page = 1, limit = 50 } = req.query;

            // Placeholder activity logs
            const logs = [
                {
                    id: 1,
                    action: 'user_approved',
                    details: 'Restaurant user approved',
                    admin_id: req.user.id,
                    timestamp: new Date().toISOString()
                }
            ];

            res.json({
                success: true,
                data: {
                    logs,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: logs.length,
                        total_pages: 1
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get activity logs error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get activity logs'
            });
        }
    }

    // Export data (placeholder)
    static async exportData(req, res) {
        try {
            const { type } = req.params; // users, restaurants, influencers, campaigns

            // Placeholder export functionality
            res.json({
                success: true,
                message: `${type} data export initiated`,
                data: {
                    export_id: `export_${Date.now()}`,
                    status: 'processing',
                    estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Export data error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to initiate data export'
            });
        }
    }
}

module.exports = AdminControllerMVP;