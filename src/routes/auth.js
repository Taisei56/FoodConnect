const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
    validateRegistration, 
    validateLogin,
    handleValidationErrors
} = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

// Test route
router.get('/test', AuthController.test);

// Temporarily bypass validation for debugging
router.post('/register', AuthController.register);
// router.post('/register', validateRegistration, AuthController.register);

router.post('/login', validateLogin, AuthController.login);

router.get('/me', authenticateToken, AuthController.getCurrentUser);

router.post('/logout', AuthController.logout);

router.post('/request-password-reset', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    handleValidationErrors
], AuthController.requestPasswordReset);

router.post('/reset-password', [
    body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors
], AuthController.resetPassword);

router.post('/change-password', [
    authenticateToken,
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    handleValidationErrors
], AuthController.changePassword);

// Email verification routes
router.get('/verify-email', AuthController.verifyEmail);

router.post('/resend-verification', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    handleValidationErrors
], AuthController.resendVerification);

module.exports = router;