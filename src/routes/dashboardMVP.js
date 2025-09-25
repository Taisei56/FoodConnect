const express = require('express');
const router = express.Router();
const authControllerMVP = require('../controllers/authControllerMVP');
const adminControllerMVP = require('../controllers/adminControllerMVP');
const campaignControllerMVP = require('../controllers/campaignControllerMVP');
const messageControllerMVP = require('../controllers/messageControllerMVP');
const paymentControllerMVP = require('../controllers/paymentControllerMVP');
const contentControllerMVP = require('../controllers/contentControllerMVP');

// Main dashboard route
router.get('/', authControllerMVP.requireAuth, async (req, res) => {
    try {
        const user = req.user;

        switch (user.user_type) {
            case 'admin':
                return res.redirect('/dashboard/admin');
            case 'restaurant':
                return res.redirect('/dashboard/restaurant');
            case 'influencer':
                return res.redirect('/dashboard/influencer');
            default:
                return res.redirect('/auth/login-mvp');
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading dashboard'
        });
    }
});

// Admin Dashboard
router.get('/admin', authControllerMVP.requireAuth, authControllerMVP.requireRole('admin'), async (req, res) => {
    try {
        const stats = await adminControllerMVP.getDashboard();
        const pendingApprovals = await adminControllerMVP.getPendingApprovals();

        res.render('dashboard/admin-dashboard', {
            title: 'Admin Dashboard - FoodConnect Malaysia',
            user: req.user,
            stats: stats || {
                total_users: 0,
                total_campaigns: 0,
                pending_approvals: 0,
                total_revenue: 0
            },
            pendingApprovals: pendingApprovals || [],
            recentActivity: [],
            systemAlerts: [],
            pendingItems: [],
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.render('dashboard/admin-dashboard', {
            title: 'Admin Dashboard - FoodConnect Malaysia',
            user: req.user,
            stats: {
                total_users: 0,
                total_campaigns: 0,
                pending_approvals: 0,
                total_revenue: 0
            },
            pendingApprovals: [],
            recentActivity: [],
            systemAlerts: [],
            pendingItems: [],
            error: 'Error loading dashboard data',
            success: req.flash('success')
        });
    }
});

// Restaurant Dashboard
router.get('/restaurant', authControllerMVP.requireAuth, authControllerMVP.requireRole('restaurant'), async (req, res) => {
    try {
        // Get basic dashboard data with fallback values
        const stats = {
            active_campaigns: 0,
            total_applications: 0,
            approved_content: 0,
            total_spent: 0
        };

        res.render('dashboard/restaurant-dashboard', {
            title: 'Restaurant Dashboard - FoodConnect Malaysia',
            user: req.user,
            restaurant: req.user.restaurant_profile || {},
            stats,
            recentCampaigns: [],
            unreadMessages: 0,
            notifications: [],
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Restaurant dashboard error:', error);
        res.render('dashboard/restaurant-dashboard', {
            title: 'Restaurant Dashboard - FoodConnect Malaysia',
            user: req.user,
            restaurant: {},
            stats: {
                active_campaigns: 0,
                total_applications: 0,
                approved_content: 0,
                total_spent: 0
            },
            recentCampaigns: [],
            unreadMessages: 0,
            notifications: [],
            error: 'Error loading dashboard data',
            success: req.flash('success')
        });
    }
});

// Influencer Dashboard
router.get('/influencer', authControllerMVP.requireAuth, authControllerMVP.requireRole('influencer'), async (req, res) => {
    try {
        const stats = {
            active_applications: 0,
            completed_campaigns: 0,
            pending_content: 0,
            total_earnings: 0
        };

        res.render('dashboard/influencer-dashboard', {
            title: 'Influencer Dashboard - FoodConnect Malaysia',
            user: req.user,
            influencer: req.user.influencer_profile || {},
            stats,
            recentApplications: [],
            unreadMessages: 0,
            recentActivity: [],
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Influencer dashboard error:', error);
        res.render('dashboard/influencer-dashboard', {
            title: 'Influencer Dashboard - FoodConnect Malaysia',
            user: req.user,
            influencer: {},
            stats: {
                active_applications: 0,
                completed_campaigns: 0,
                pending_content: 0,
                total_earnings: 0
            },
            recentApplications: [],
            unreadMessages: 0,
            recentActivity: [],
            error: 'Error loading dashboard data',
            success: req.flash('success')
        });
    }
});

// Dashboard section routes (simplified)
router.get('/restaurant/:section', authControllerMVP.requireAuth, authControllerMVP.requireRole('restaurant'), async (req, res) => {
    const section = req.params.section;

    try {
        switch (section) {
            case 'campaigns':
                res.redirect('/campaigns');
                break;

            case 'applications':
                res.json({ message: 'Applications section coming soon', applications: [] });
                break;

            case 'content':
                res.redirect('/content/restaurant');
                break;

            case 'payments':
                res.redirect('/payments/restaurant');
                break;

            case 'messages':
                res.json({ message: 'Messages section coming soon', messages: [] });
                break;

            case 'profile':
                res.redirect('/auth/profile');
                break;

            default:
                res.status(404).json({ error: 'Section not found' });
        }
    } catch (error) {
        console.error(`Restaurant ${section} section error:`, error);
        res.status(500).json({ error: 'Error loading section' });
    }
});

router.get('/influencer/:section', authControllerMVP.requireAuth, authControllerMVP.requireRole('influencer'), async (req, res) => {
    const section = req.params.section;

    try {
        switch (section) {
            case 'campaigns':
                res.redirect('/campaigns/browse');
                break;

            case 'applications':
                res.json({ message: 'Applications section coming soon', applications: [] });
                break;

            case 'content':
                res.redirect('/content/influencer');
                break;

            case 'earnings':
                res.redirect('/payments/influencer');
                break;

            case 'messages':
                res.json({ message: 'Messages section coming soon', messages: [] });
                break;

            case 'profile':
                res.redirect('/auth/profile');
                break;

            default:
                res.status(404).json({ error: 'Section not found' });
        }
    } catch (error) {
        console.error(`Influencer ${section} section error:`, error);
        res.status(500).json({ error: 'Error loading section' });
    }
});

// Helper functions
async function getRestaurantNotifications(userId) {
    // Implementation for getting restaurant-specific notifications
    return [];
}

async function getInfluencerStats(userId) {
    // Implementation for getting influencer stats
    return {
        active_applications: 0,
        completed_campaigns: 0,
        pending_content: 0,
        total_earnings: 0
    };
}

async function getRecentApplications(userId) {
    // Implementation for getting recent applications
    return [];
}

async function getInfluencerActivity(userId) {
    // Implementation for getting recent activity
    return [];
}

async function getInfluencerApplications(userId) {
    // Implementation for getting influencer applications
    return [];
}

module.exports = router;