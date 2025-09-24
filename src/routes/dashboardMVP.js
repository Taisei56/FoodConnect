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
        const stats = await adminControllerMVP.getDashboardStats();
        const pendingApprovals = await adminControllerMVP.getPendingApprovals();
        const recentActivity = await adminControllerMVP.getRecentActivity();
        const systemAlerts = await adminControllerMVP.getSystemAlerts();
        const pendingItems = await adminControllerMVP.getPendingItems();

        res.render('dashboard/admin-dashboard', {
            title: 'Admin Dashboard - FoodConnect Malaysia',
            user: req.user,
            stats,
            pendingApprovals,
            recentActivity,
            systemAlerts,
            pendingItems,
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading admin dashboard'
        });
    }
});

// Restaurant Dashboard
router.get('/restaurant', authControllerMVP.requireAuth, authControllerMVP.requireRole('restaurant'), async (req, res) => {
    try {
        const stats = await campaignControllerMVP.getRestaurantStats(req.user.id);
        const recentCampaigns = await campaignControllerMVP.getRecentCampaigns(req.user.id);
        const unreadMessages = await messageControllerMVP.getUnreadCount(req.user.id);
        const notifications = await getRestaurantNotifications(req.user.id);

        res.render('dashboard/restaurant-dashboard', {
            title: 'Restaurant Dashboard - FoodConnect Malaysia',
            user: req.user,
            restaurant: req.user.restaurant_profile,
            stats,
            recentCampaigns,
            unreadMessages,
            notifications,
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Restaurant dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading restaurant dashboard'
        });
    }
});

// Influencer Dashboard
router.get('/influencer', authControllerMVP.requireAuth, authControllerMVP.requireRole('influencer'), async (req, res) => {
    try {
        const stats = await getInfluencerStats(req.user.id);
        const recentApplications = await getRecentApplications(req.user.id);
        const unreadMessages = await messageControllerMVP.getUnreadCount(req.user.id);
        const recentActivity = await getInfluencerActivity(req.user.id);

        res.render('dashboard/influencer-dashboard', {
            title: 'Influencer Dashboard - FoodConnect Malaysia',
            user: req.user,
            influencer: req.user.influencer_profile,
            stats,
            recentApplications,
            unreadMessages,
            recentActivity,
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Influencer dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading influencer dashboard'
        });
    }
});

// Dashboard section routes (AJAX)
router.get('/restaurant/:section', authControllerMVP.requireAuth, authControllerMVP.requireRole('restaurant'), async (req, res) => {
    const section = req.params.section;

    try {
        switch (section) {
            case 'campaigns':
                const campaigns = await campaignControllerMVP.getRestaurantCampaigns(req.user.id);
                res.render(`dashboard/sections/restaurant-campaigns`, { campaigns, user: req.user });
                break;

            case 'applications':
                const applications = await campaignControllerMVP.getRestaurantApplications(req.user.id);
                res.render(`dashboard/sections/restaurant-applications`, { applications, user: req.user });
                break;

            case 'content':
                const content = await contentControllerMVP.getRestaurantContent(req.user.id);
                res.render(`dashboard/sections/restaurant-content`, { content, user: req.user });
                break;

            case 'payments':
                const payments = await paymentControllerMVP.getRestaurantPayments(req.user.id);
                res.render(`dashboard/sections/restaurant-payments`, { payments, user: req.user });
                break;

            case 'messages':
                const messages = await messageControllerMVP.getConversations(req.user.id);
                res.render(`dashboard/sections/messages`, { messages, user: req.user });
                break;

            case 'profile':
                res.render(`dashboard/sections/restaurant-profile`, {
                    user: req.user,
                    restaurant: req.user.restaurant_profile
                });
                break;

            default:
                res.status(404).send('Section not found');
        }
    } catch (error) {
        console.error(`Restaurant ${section} section error:`, error);
        res.status(500).send('Error loading section');
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
                const applications = await getInfluencerApplications(req.user.id);
                res.render(`dashboard/sections/influencer-applications`, { applications, user: req.user });
                break;

            case 'content':
                const content = await contentControllerMVP.getInfluencerContent(req.user.id);
                res.render(`dashboard/sections/influencer-content`, { content, user: req.user });
                break;

            case 'earnings':
                const earnings = await paymentControllerMVP.getInfluencerEarnings(req.user.id);
                res.render(`dashboard/sections/influencer-earnings`, { earnings, user: req.user });
                break;

            case 'messages':
                const messages = await messageControllerMVP.getConversations(req.user.id);
                res.render(`dashboard/sections/messages`, { messages, user: req.user });
                break;

            case 'profile':
                res.render(`dashboard/sections/influencer-profile`, {
                    user: req.user,
                    influencer: req.user.influencer_profile
                });
                break;

            default:
                res.status(404).send('Section not found');
        }
    } catch (error) {
        console.error(`Influencer ${section} section error:`, error);
        res.status(500).send('Error loading section');
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