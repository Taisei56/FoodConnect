const express = require('express');
const router = express.Router();

// Homepage
router.get('/', (req, res) => {
    res.render('index', { 
        title: 'FoodConnect Malaysia - Connect Restaurants with Food Influencers'
    });
});

// Authentication pages
router.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Login - FoodConnect Malaysia' 
    });
});

router.get('/register', (req, res) => {
    res.render('auth/register', { 
        title: 'Register - FoodConnect Malaysia' 
    });
});

// Dashboard (protected route)
router.get('/dashboard', (req, res) => {
    res.render('dashboard/index', { 
        title: 'Dashboard - FoodConnect Malaysia' 
    });
});

// Profile pages
router.get('/profile', (req, res) => {
    res.render('profile/index', { 
        title: 'My Profile - FoodConnect Malaysia' 
    });
});

router.get('/profile/create', (req, res) => {
    res.render('profile/create', { 
        title: 'Create Profile - FoodConnect Malaysia' 
    });
});

// Campaign pages
router.get('/campaigns', (req, res) => {
    res.render('campaigns/index', { 
        title: 'Browse Campaigns - FoodConnect Malaysia' 
    });
});

router.get('/campaigns/create', (req, res) => {
    res.render('campaigns/create', { 
        title: 'Create Campaign - FoodConnect Malaysia' 
    });
});

router.get('/campaigns/:id', (req, res) => {
    res.render('campaigns/detail', { 
        title: 'Campaign Details - FoodConnect Malaysia',
        campaignId: req.params.id
    });
});

// Restaurant pages
router.get('/restaurants', (req, res) => {
    res.render('restaurants/index', { 
        title: 'Browse Restaurants - FoodConnect Malaysia' 
    });
});

router.get('/restaurants/:id', (req, res) => {
    res.render('restaurants/detail', { 
        title: 'Restaurant Details - FoodConnect Malaysia',
        restaurantId: req.params.id
    });
});

// Influencer pages
router.get('/influencers', (req, res) => {
    res.render('influencers/index', { 
        title: 'Browse Influencers - FoodConnect Malaysia' 
    });
});

router.get('/influencers/:id', (req, res) => {
    res.render('influencers/detail', { 
        title: 'Influencer Profile - FoodConnect Malaysia',
        influencerId: req.params.id
    });
});

// Application pages
router.get('/applications', (req, res) => {
    res.render('applications/index', { 
        title: 'My Applications - FoodConnect Malaysia' 
    });
});

// Commission pages
router.get('/commissions', (req, res) => {
    res.render('commissions/index', { 
        title: 'Commission Tracking - FoodConnect Malaysia' 
    });
});

// Static pages
router.get('/about', (req, res) => {
    res.render('static/about', { 
        title: 'About Us - FoodConnect Malaysia' 
    });
});

router.get('/terms', (req, res) => {
    res.render('static/terms', { 
        title: 'Terms of Service - FoodConnect Malaysia' 
    });
});

router.get('/privacy', (req, res) => {
    res.render('static/privacy', { 
        title: 'Privacy Policy - FoodConnect Malaysia' 
    });
});

router.get('/contact', (req, res) => {
    res.render('static/contact', { 
        title: 'Contact Us - FoodConnect Malaysia' 
    });
});

module.exports = router;