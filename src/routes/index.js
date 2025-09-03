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

// Debug static files
router.get('/static-test', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const publicPath = path.join(__dirname, '../public');
    const mainJsPath = path.join(publicPath, 'js/main.js');
    
    try {
        const exists = fs.existsSync(publicPath);
        const mainJsExists = fs.existsSync(mainJsPath);
        
        res.json({
            message: 'Static file debug',
            publicPath,
            publicExists: exists,
            mainJsPath,
            mainJsExists,
            cwd: process.cwd(),
            __dirname,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
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

// Emergency static file serving - serve main.js directly
router.get('/js/main.js', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const mainJsPath = path.join(__dirname, '../public/js/main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(mainJsContent);
    } catch (error) {
        res.status(404).json({
            error: 'main.js not found',
            message: error.message
        });
    }
});

// Emergency static file serving - serve auth.js directly
router.get('/js/auth.js', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const authJsPath = path.join(__dirname, '../public/js/auth.js');
        const authJsContent = fs.readFileSync(authJsPath, 'utf8');
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(authJsContent);
    } catch (error) {
        res.status(404).json({
            error: 'auth.js not found',
            message: error.message
        });
    }
});

module.exports = router;