const express = require('express');
const router = express.Router();
const campaignControllerMVP = require('../controllers/campaignControllerMVP');
const authControllerMVP = require('../controllers/authControllerMVP');
const { body, query } = require('express-validator');

// Browse campaigns (public for influencers)
router.get('/browse', campaignControllerMVP.getPublishedCampaigns);

// Create campaign form (restaurants only)
router.get('/create', authControllerMVP.requireAuth, authControllerMVP.requireRole('restaurant'), (req, res) => {
    res.render('campaigns/create-mvp', {
        title: 'Create Campaign - FoodConnect Malaysia',
        user: req.user,
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Create campaign
router.post('/create',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    campaignControllerMVP.getCampaignValidation(),
    campaignControllerMVP.createCampaign
);

// Save campaign draft
router.post('/save-draft',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    campaignControllerMVP.saveDraft
);

// Campaign detail page
router.get('/:id', campaignControllerMVP.getCampaign);

// Update campaign
router.post('/:id/update',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    campaignControllerMVP.updateCampaign
);

// Get campaign applications
router.get('/:id/applications',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    campaignControllerMVP.getApplication
);

// Approve/reject applications
router.post('/application/:id/process',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    campaignControllerMVP.processApplication
);

// Apply to campaign (influencers)
router.post('/:id/apply',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('influencer'),
    campaignControllerMVP.applyToCampaign
);

// Get form data for campaign creation
router.get('/form-data', campaignControllerMVP.getCampaignFormData);

module.exports = router;