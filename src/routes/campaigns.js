const express = require('express');
const CampaignController = require('../controllers/campaignController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { validateCampaign, validateId, validateQuery } = require('../middleware/validation');

const router = express.Router();

router.post('/', [
    authenticateToken,
    requireRole('restaurant'),
    validateCampaign
], CampaignController.createCampaign);

router.get('/', [
    optionalAuth,
    validateQuery
], CampaignController.getAllCampaigns);

router.get('/my-campaigns', [
    authenticateToken,
    requireRole('restaurant')
], CampaignController.getMyRestaurantCampaigns);

router.get('/:id', [
    validateId,
    optionalAuth
], CampaignController.getCampaignById);

router.put('/:id', [
    authenticateToken,
    requireRole('restaurant'),
    validateId,
    validateCampaign
], CampaignController.updateCampaign);

router.post('/:id/publish', [
    authenticateToken,
    requireRole('restaurant'),
    validateId
], CampaignController.publishCampaign);

router.post('/:id/start', [
    authenticateToken,
    requireRole('restaurant'),
    validateId
], CampaignController.startCampaign);

router.post('/:id/complete', [
    authenticateToken,
    requireRole('restaurant'),
    validateId
], CampaignController.completeCampaign);

router.delete('/:id', [
    authenticateToken,
    requireRole('restaurant'),
    validateId
], CampaignController.deleteCampaign);

// Additional routes for new functionality
router.get('/stats', [
    authenticateToken
], CampaignController.getCampaignStats);

router.get('/available', [
    authenticateToken,
    requireRole('influencer')
], CampaignController.getAvailableCampaignsForInfluencer);

module.exports = router;