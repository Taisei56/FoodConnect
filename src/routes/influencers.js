const express = require('express');
const InfluencerController = require('../controllers/influencerController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { validateInfluencerProfile, validateId, handleValidationErrors } = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

router.post('/profile', [
    authenticateToken,
    requireRole('influencer'),
    uploadMultiple([
        { name: 'profile_image', maxCount: 1 },
        { name: 'portfolio_images', maxCount: 5 }
    ]),
    validateInfluencerProfile
], InfluencerController.createProfile);

router.get('/profile', [
    authenticateToken,
    requireRole('influencer')
], InfluencerController.getProfile);

router.put('/profile', [
    authenticateToken,
    requireRole('influencer'),
    uploadMultiple([
        { name: 'profile_image', maxCount: 1 },
        { name: 'portfolio_images', maxCount: 5 }
    ]),
    validateInfluencerProfile
], InfluencerController.updateProfile);

router.post('/profile/remove-portfolio-image', [
    authenticateToken,
    requireRole('influencer'),
    body('imageUrl')
        .notEmpty()
        .withMessage('Image URL is required'),
    handleValidationErrors
], InfluencerController.removePortfolioImage);

router.delete('/profile', [
    authenticateToken,
    requireRole('influencer')
], InfluencerController.deleteProfile);

router.get('/', optionalAuth, InfluencerController.getAllInfluencers);

router.get('/:id', [
    validateId,
    optionalAuth
], InfluencerController.getInfluencerById);

module.exports = router;