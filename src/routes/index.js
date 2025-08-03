const express = require('express');
const authRoutes = require('./auth');
const restaurantRoutes = require('./restaurants');
const influencerRoutes = require('./influencers');
const campaignRoutes = require('./campaigns');
const applicationRoutes = require('./applications');
const commissionRoutes = require('./commissions');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/influencers', influencerRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/applications', applicationRoutes);
router.use('/commissions', commissionRoutes);

router.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'FoodConnect Malaysia API'
    });
});

router.get('/debug', async (req, res) => {
    const { query } = require('../config/database');
    try {
        const result = await query('SELECT * FROM users WHERE email = $1', ['restaurant@demo.com']);
        res.json({ 
            message: 'Debug info',
            user: result.rows[0],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;