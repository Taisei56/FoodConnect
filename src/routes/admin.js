const express = require('express');
const router = express.Router();
const { _data } = require('../config/simple-db');

// Simple admin endpoint to view registrations
router.get('/registrations', (req, res) => {
    const users = _data.users.map(user => ({
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        status: user.status,
        registered_at: user.created_at
    }));
    
    res.json({
        title: 'FoodConnect Malaysia - Registered Users',
        total: users.length,
        users: users,
        summary: {
            restaurants: users.filter(u => u.user_type === 'restaurant').length,
            influencers: users.filter(u => u.user_type === 'influencer').length,
            pending: users.filter(u => u.status === 'pending').length,
            approved: users.filter(u => u.status === 'approved').length
        }
    });
});

// Admin endpoint to approve all pending users
router.post('/approve-all', (req, res) => {
    const pendingUsers = _data.users.filter(u => u.status === 'pending');
    
    pendingUsers.forEach(user => {
        user.status = 'approved';
        user.updated_at = new Date();
    });
    
    res.json({
        message: `${pendingUsers.length} users approved successfully`,
        approved_users: pendingUsers.map(u => ({ id: u.id, email: u.email }))
    });
});

module.exports = router;