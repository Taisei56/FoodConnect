const express = require('express');
const ApplicationController = require('../controllers/applicationController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateApplication, validateStatusUpdate, validateId } = require('../middleware/validation');

const router = express.Router();

router.post('/campaigns/:campaignId/apply', [
    authenticateToken,
    requireRole('influencer'),
    validateApplication
], ApplicationController.applyToCampaign);

router.get('/my-applications', [
    authenticateToken,
    requireRole('influencer')
], ApplicationController.getMyApplications);

router.get('/campaigns/:campaignId', [
    authenticateToken,
    requireRole('restaurant'),
    validateId
], ApplicationController.getCampaignApplications);

router.put('/:id/status', [
    authenticateToken,
    requireRole('restaurant'),
    validateId,
    validateStatusUpdate
], ApplicationController.updateApplicationStatus);

router.delete('/:id', [
    authenticateToken,
    requireRole('influencer'),
    validateId
], ApplicationController.withdrawApplication);

router.get('/:id', [
    authenticateToken,
    validateId
], ApplicationController.getApplicationById);

module.exports = router;