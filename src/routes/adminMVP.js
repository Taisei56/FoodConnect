const express = require('express');
const router = express.Router();
const adminControllerMVP = require('../controllers/adminControllerMVP');
const authControllerMVP = require('../controllers/authControllerMVP');
const { body, query } = require('express-validator');

// Admin authentication middleware
router.use(authControllerMVP.requireAuth);
router.use(authControllerMVP.requireRole('admin'));

// Admin dashboard sections
router.get('/dashboard', adminControllerMVP.getDashboard);
router.get('/users', adminControllerMVP.getUsers);
router.get('/campaigns', adminControllerMVP.getCampaigns);
router.get('/pending-approvals', adminControllerMVP.getPendingApprovals);
router.get('/follower-updates', adminControllerMVP.getFollowerUpdateRequests);
router.get('/settings', adminControllerMVP.getPlatformSettings);

// User management
router.post('/users/:id/approval', adminControllerMVP.processUserApproval);
router.post('/users/:id/status', adminControllerMVP.updateUserStatus);

// Follower update management
router.post('/follower-updates/:id/process', adminControllerMVP.processFollowerUpdate);

// Platform settings
router.post('/settings', adminControllerMVP.updatePlatformSettings);

module.exports = router;