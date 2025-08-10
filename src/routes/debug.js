const express = require('express');
const router = express.Router();
const { _data } = require('../config/simple-db');

// Debug endpoint to check deployment version
router.get('/version', (req, res) => {
    res.json({
        message: 'MVP Launch September 2025 - Debug Version',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: 'simple-db',
        totalUsers: _data.users.length,
        commit: '3b1c610',
        status: 'Updated deployment'
    });
});

module.exports = router;