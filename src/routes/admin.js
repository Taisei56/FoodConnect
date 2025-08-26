const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Simple admin routes (without complex controller for now)
router.get('/dashboard', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Admin dashboard placeholder',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

router.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Admin API is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;