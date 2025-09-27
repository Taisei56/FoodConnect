const express = require('express');
const router = express.Router();
const authControllerMVP = require('../controllers/authControllerMVP');
const campaignControllerMVP = require('../controllers/campaignControllerMVP');
const messageControllerMVP = require('../controllers/messageControllerMVP');
const paymentControllerMVP = require('../controllers/paymentControllerMVP');
const contentControllerMVP = require('../controllers/contentControllerMVP');
const adminControllerMVP = require('../controllers/adminControllerMVP');
const ApplicationMVP = require('../models/ApplicationMVP');
const { body } = require('express-validator');

// Unauthenticated API routes (must come before auth middleware)
router.post('/auth/register',
    authControllerMVP.getRegistrationValidation(),
    authControllerMVP.register
);

router.post('/auth/login', authControllerMVP.login);

router.get('/auth/verify-email/:token', authControllerMVP.verifyEmail);

router.post('/auth/forgot-password', authControllerMVP.requestPasswordReset);

router.post('/auth/reset-password/:token', authControllerMVP.resetPassword);

router.get('/auth/registration-data', authControllerMVP.getRegistrationData);

// Authentication middleware for API routes (applies to routes below)
router.use(authControllerMVP.requireAuth);

// Campaign API routes
router.get('/campaigns/:id', async (req, res) => {
    try {
        const campaign = await campaignControllerMVP.getCampaignById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    } catch (error) {
        console.error('API Error - Get campaign:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await campaignControllerMVP.getCampaigns(req.query);
        res.json({
            campaigns,
            total: campaigns.length,
            query: req.query
        });
    } catch (error) {
        console.error('API Error - Get campaigns:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Application API routes
router.post('/applications/apply', [
    body('campaign_id').isInt(),
    body('message').trim().isLength({ min: 10, max: 500 }),
    body('timeline').isIn(['1-3 days', '3-7 days', '1-2 weeks', '2-4 weeks']),
    body('platforms').isArray({ min: 1 })
], async (req, res) => {
    try {
        const { campaign_id, message, timeline, platforms } = req.body;

        // Check if user is influencer
        if (req.user.user_type !== 'influencer') {
            return res.status(403).json({ error: 'Only influencers can apply to campaigns' });
        }

        // Check if already applied
        const applicationModel = new ApplicationMVP();
        const existingApplication = await applicationModel.findByCampaignAndInfluencer(
            campaign_id,
            req.user.influencer_profile.id
        );

        if (existingApplication) {
            return res.status(400).json({ error: 'You have already applied to this campaign' });
        }

        // Create application
        const applicationData = {
            campaign_id,
            influencer_id: req.user.influencer_profile.id,
            message,
            proposed_timeline: timeline,
            platforms: platforms,
            status: 'pending'
        };

        const application = await applicationModel.create(applicationData);

        res.json({
            success: true,
            message: 'Application submitted successfully',
            application_id: application.id
        });

    } catch (error) {
        console.error('API Error - Apply to campaign:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
});

// Payment API routes
router.get('/payments/:id', async (req, res) => {
    try {
        const payment = await paymentControllerMVP.getPaymentById(req.params.id);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Check authorization
        const canView = (req.user.user_type === 'admin') ||
                       (req.user.user_type === 'restaurant' && payment.restaurant_id === req.user.restaurant_profile?.id) ||
                       (req.user.user_type === 'influencer' && payment.influencer_id === req.user.influencer_profile?.id);

        if (!canView) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(payment);
    } catch (error) {
        console.error('API Error - Get payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Content API routes
router.post('/content/submit', contentControllerMVP.submitContent);

router.post('/content/:id/approve', authControllerMVP.requireRole('restaurant'), async (req, res) => {
    try {
        const result = await contentControllerMVP.approveContent(req.params.id, req.body.feedback);
        res.json({ success: true, content: result });
    } catch (error) {
        console.error('API Error - Approve content:', error);
        res.status(500).json({ error: 'Failed to approve content' });
    }
});

router.post('/content/:id/reject', authControllerMVP.requireRole('restaurant'), async (req, res) => {
    try {
        const result = await contentControllerMVP.rejectContent(req.params.id, req.body.feedback);
        res.json({ success: true, content: result });
    } catch (error) {
        console.error('API Error - Reject content:', error);
        res.status(500).json({ error: 'Failed to reject content' });
    }
});

// Message API routes
router.get('/messages/conversations', async (req, res) => {
    try {
        const conversations = await messageControllerMVP.getConversations(req.user.id);
        res.json(conversations);
    } catch (error) {
        console.error('API Error - Get conversations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/messages/conversation/:userId', async (req, res) => {
    try {
        const messages = await messageControllerMVP.getConversation(req.user.id, req.params.userId);
        res.json(messages);
    } catch (error) {
        console.error('API Error - Get conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/messages/send', [
    body('receiver_id').isInt(),
    body('message').trim().isLength({ min: 1, max: 1000 })
], async (req, res) => {
    try {
        const message = await messageControllerMVP.sendMessage(
            req.user.id,
            req.body.receiver_id,
            req.body.message,
            req.body.campaign_id || null
        );
        res.json({ success: true, message });
    } catch (error) {
        console.error('API Error - Send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/messages/:id/read', async (req, res) => {
    try {
        await messageControllerMVP.markAsRead(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('API Error - Mark message as read:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// Admin API routes
router.post('/admin/approve/:type/:id', authControllerMVP.requireRole('admin'), async (req, res) => {
    try {
        const { type, id } = req.params;
        let result;

        switch (type) {
            case 'user':
                result = await adminControllerMVP.approveUser(id);
                break;
            case 'content':
                result = await adminControllerMVP.approveContent(id);
                break;
            case 'payment':
                result = await adminControllerMVP.approvePayment(id);
                break;
            case 'follower_update':
                result = await adminControllerMVP.approveFollowerUpdate(id);
                break;
            default:
                return res.status(400).json({ error: 'Invalid approval type' });
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('API Error - Admin approve:', error);
        res.status(500).json({ error: 'Failed to approve item' });
    }
});

router.post('/admin/reject/:type/:id', authControllerMVP.requireRole('admin'), async (req, res) => {
    try {
        const { type, id } = req.params;
        const { reason } = req.body;
        let result;

        switch (type) {
            case 'user':
                result = await adminControllerMVP.rejectUser(id, reason);
                break;
            case 'content':
                result = await adminControllerMVP.rejectContent(id, reason);
                break;
            case 'payment':
                result = await adminControllerMVP.rejectPayment(id, reason);
                break;
            case 'follower_update':
                result = await adminControllerMVP.rejectFollowerUpdate(id, reason);
                break;
            default:
                return res.status(400).json({ error: 'Invalid rejection type' });
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('API Error - Admin reject:', error);
        res.status(500).json({ error: 'Failed to reject item' });
    }
});

// Statistics API routes
router.get('/stats/dashboard', async (req, res) => {
    try {
        let stats;

        switch (req.user.user_type) {
            case 'admin':
                stats = await adminControllerMVP.getDashboardStats();
                break;
            case 'restaurant':
                stats = await campaignControllerMVP.getRestaurantStats(req.user.id);
                break;
            case 'influencer':
                stats = await getInfluencerStats(req.user.id);
                break;
            default:
                return res.status(403).json({ error: 'Access denied' });
        }

        res.json(stats);
    } catch (error) {
        console.error('API Error - Get dashboard stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// File upload API routes (placeholder - implement as needed)
// router.post('/upload/avatar', authControllerMVP.uploadAvatar);
// router.post('/upload/logo', authControllerMVP.requireRole('restaurant'), authControllerMVP.uploadLogo);
// router.post('/upload/content', contentControllerMVP.uploadContent);

// Search API routes
router.get('/search/campaigns', campaignControllerMVP.getPublishedCampaigns);

router.get('/search/influencers', authControllerMVP.requireRole('restaurant'), async (req, res) => {
    try {
        const { q, filters } = req.query;
        const influencers = await searchInfluencers(q, filters);
        res.json({
            query: q,
            results: influencers,
            total: influencers.length
        });
    } catch (error) {
        console.error('API Error - Search influencers:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Helper functions
async function getInfluencerStats(userId) {
    // Implementation for getting influencer statistics
    return {
        active_applications: 0,
        completed_campaigns: 0,
        pending_content: 0,
        total_earnings: 0,
        this_month: 0
    };
}

async function searchInfluencers(query, filters) {
    // Implementation for searching influencers
    return [];
}

module.exports = router;