const express = require('express');
const authRoutes = require('./auth');
const restaurantRoutes = require('./restaurants');
const influencerRoutes = require('./influencers');
const campaignRoutes = require('./campaigns');
const applicationRoutes = require('./applications');
const commissionRoutes = require('./commissions');
const debugRoutes = require('./debug');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/influencers', influencerRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/applications', applicationRoutes);
router.use('/commissions', commissionRoutes);
router.use('/debug', debugRoutes);
router.use('/admin', adminRoutes);
router.use('/health', healthRoutes);

router.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'FoodConnect Malaysia API',
        version: 'MVP v3.0'
    });
});

// Simple test endpoint
router.get('/test', (req, res) => {
    res.json({ 
        message: 'API is working', 
        timestamp: new Date().toISOString(),
        routes_loaded: [
            '/auth',
            '/restaurants', 
            '/influencers',
            '/campaigns',
            '/applications',
            '/commissions',
            '/admin',
            '/health'
        ]
    });
});

router.get('/debug', async (req, res) => {
    try {
        // Safe debug endpoint without database dependency
        res.json({ 
            message: 'Debug endpoint working',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            version: 'MVP v3.0 - Complete'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;