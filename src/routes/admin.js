const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// All admin routes require authentication
router.use(authMiddleware);

// Admin dashboard
router.get('/dashboard', adminController.dashboard);

// API routes for admin data
router.get('/api/stats', adminController.getStats);
router.get('/api/users', adminController.getUsers);
router.get('/api/users/:id', adminController.getUserDetails);
router.get('/api/export/users', adminController.exportUsers);

module.exports = router;