const express = require('express');
const RestaurantController = require('../controllers/restaurantController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { validateRestaurantProfile, validateId } = require('../middleware/validation');

const router = express.Router();

router.post('/profile', [
    authenticateToken,
    requireRole('restaurant'),
    uploadSingle('profile_image'),
    validateRestaurantProfile
], RestaurantController.createProfile);

router.get('/profile', [
    authenticateToken,
    requireRole('restaurant')
], RestaurantController.getProfile);

router.put('/profile', [
    authenticateToken,
    requireRole('restaurant'),
    uploadSingle('profile_image'),
    validateRestaurantProfile
], RestaurantController.updateProfile);

router.delete('/profile', [
    authenticateToken,
    requireRole('restaurant')
], RestaurantController.deleteProfile);

router.get('/', optionalAuth, RestaurantController.getAllRestaurants);

router.get('/:id', [
    validateId,
    optionalAuth
], RestaurantController.getRestaurantById);

// Additional routes for enhanced functionality
router.get('/search/location', optionalAuth, RestaurantController.getRestaurantsByLocation);
router.get('/search/dietary', optionalAuth, RestaurantController.getRestaurantsByDietary);
router.get('/stats/location', optionalAuth, RestaurantController.getLocationStats);

module.exports = router;