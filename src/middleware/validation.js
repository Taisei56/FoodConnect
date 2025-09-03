const { body, validationResult, param, query } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ Validation failed:', errors.array());
        
        const errorMessages = errors.array().map(error => error.msg).join('. ');
        
        return res.status(400).json({
            success: false,
            error: 'Validation failed: ' + errorMessages,
            details: errors.array(),
            validationErrors: true
        });
    }
    next();
};

const validateRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
        // Removed strict password complexity for MVP
    
    body('user_type')
        .isIn(['restaurant', 'influencer', 'admin'])
        .withMessage('User type must be restaurant, influencer, or admin'),
    
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    
    handleValidationErrors
];

const validateRestaurantProfile = [
    body('business_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Business name must be between 2 and 255 characters'),
    
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Address must be less than 500 characters'),
        
    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('City must be less than 100 characters'),
        
    body('state')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('State must be less than 100 characters'),
    
    body('phone')
        .optional()
        .matches(/^[\+]?[\d\s\-\(\)]+$/)
        .withMessage('Invalid phone number format'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),
        
    body('google_maps_link')
        .optional()
        .trim()
        .isURL()
        .withMessage('Google Maps link must be a valid URL'),
        
    body('website')
        .optional()
        .trim()
        .isURL()
        .withMessage('Website must be a valid URL'),
    
    handleValidationErrors
];

const validateInfluencerProfile = [
    body('display_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Display name must be between 2 and 255 characters'),
    
    body('location')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Location must be less than 255 characters'),
        
    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('City must be less than 100 characters'),
        
    body('state')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('State must be less than 100 characters'),
    
    body('instagram_username')
        .optional()
        .trim()
        .matches(/^@?[\w\.]+$/)
        .withMessage('Invalid Instagram username format'),
        
    body('instagram_followers')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Instagram followers must be a positive number'),
        
    body('tiktok_followers')
        .optional()
        .isInt({ min: 0 })
        .withMessage('TikTok followers must be a positive number'),
        
    body('xhs_followers')
        .optional()
        .isInt({ min: 0 })
        .withMessage('XHS followers must be a positive number'),
        
    body('youtube_followers')
        .optional()
        .isInt({ min: 0 })
        .withMessage('YouTube followers must be a positive number'),
    
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters'),
        
    body('phone')
        .optional()
        .matches(/^[\+]?[\d\s\-\(\)]+$/)
        .withMessage('Invalid phone number format'),
    
    handleValidationErrors
];

const validateCampaign = [
    body('title')
        .optional()
        .trim()
        .isLength({ min: 5, max: 255 })
        .withMessage('Title must be between 5 and 255 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must be less than 2000 characters'),
        
    body('brief')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Brief must be less than 2000 characters'),
    
    body('total_budget')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Total budget must be a positive number'),
    
    body('max_influencers')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Max influencers must be between 1 and 100'),
    
    body('location')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Location must be less than 255 characters'),
    
    body('deadline')
        .optional()
        .isISO8601()
        .withMessage('Deadline must be a valid date'),
    
    handleValidationErrors
];

const validateApplication = [
    body('message')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Message must be less than 500 characters'),
    
    param('campaignId')
        .isInt({ min: 1 })
        .withMessage('Valid campaign ID is required'),
    
    handleValidationErrors
];

const validateStatusUpdate = [
    body('status')
        .isIn(['pending', 'accepted', 'rejected'])
        .withMessage('Status must be pending, accepted, or rejected'),
    
    handleValidationErrors
];

const validateQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('status')
        .optional()
        .isAlpha()
        .withMessage('Status must contain only letters'),
    
    handleValidationErrors
];

const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Valid ID is required'),
    
    handleValidationErrors
];

module.exports = {
    validateRegistration,
    validateLogin,
    validateRestaurantProfile,
    validateInfluencerProfile,
    validateCampaign,
    validateApplication,
    validateStatusUpdate,
    validateQuery,
    validateId,
    handleValidationErrors
};