const express = require('express');
const router = express.Router();
const authControllerMVP = require('../controllers/authControllerMVP');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Registration routes
router.get('/register', (req, res) => {
    res.render('auth/register-mvp', {
        title: 'Register - FoodConnect Malaysia',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

router.get('/registration-data', authControllerMVP.getRegistrationData);

router.post('/register',
    authControllerMVP.getRegistrationValidation(),
    authControllerMVP.register
);

// Login routes
router.get('/login', (req, res) => {
    res.render('auth/login-mvp', {
        title: 'Login - FoodConnect Malaysia',
        error: req.flash('error'),
        success: req.flash('success'),
        email: req.flash('email')[0] || ''
    });
});

router.post('/login', authControllerMVP.login);

// Email verification
router.get('/verify-email/:token', authControllerMVP.verifyEmail);

// Password reset routes
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password - FoodConnect Malaysia',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

router.post('/forgot-password', authControllerMVP.requestPasswordReset);

router.get('/reset-password/:token', (req, res) => {
    res.render('auth/reset-password', {
        title: 'Reset Password - FoodConnect Malaysia',
        token: req.params.token,
        error: req.flash('error'),
        success: req.flash('success')
    });
});

router.post('/reset-password/:token', authControllerMVP.resetPassword);

// Profile routes (authenticated)
router.get('/profile', authenticateToken, authControllerMVP.getProfile);

router.put('/profile', authenticateToken, authControllerMVP.updateProfile);

// Logout
router.post('/logout', authenticateToken, authControllerMVP.logout);

module.exports = router;