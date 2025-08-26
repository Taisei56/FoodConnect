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
        .isIn(['restaurant', 'influencer'])
        .withMessage('User type must be either restaurant or influencer'),
    
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
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Business name must be between 2 and 255 characters'),
    
    body('location')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Location must be between 2 and 255 characters'),
    
    body('cuisine_type')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Cuisine type must be less than 100 characters'),
    
    body('phone')
        .optional()
        .matches(/^[\+]?[\d\s\-\(\)]+$/)
        .withMessage('Invalid phone number format'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters'),
    
    handleValidationErrors
];

const validateInfluencerProfile = [
    body('display_name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Display name must be between 2 and 255 characters'),
    
    body('location')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Location must be between 2 and 255 characters'),
    
    body('instagram_handle')
        .optional()
        .trim()
        .matches(/^@?[\w\.]+$/)
        .withMessage('Invalid Instagram handle format'),
    
    body('follower_count')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Follower count must be a positive number'),
    
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters'),
    
    handleValidationErrors
];

const validateCampaign = [
    body('title')
        .trim()
        .isLength({ min: 5, max: 255 })
        .withMessage('Title must be between 5 and 255 characters'),
    
    body('description')
        .trim()
        .isLength({ min: 20, max: 2000 })
        .withMessage('Description must be between 20 and 2000 characters'),
    
    body('budget_per_influencer')
        .isFloat({ min: 50 })
        .withMessage('Budget per influencer must be at least RM 50'),
    
    body('meal_value')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Meal value must be a positive number'),
    
    body('max_influencers')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Max influencers must be between 1 and 50'),
    
    body('requirements')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Requirements must be between 10 and 1000 characters'),
    
    body('location')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Location must be between 2 and 255 characters'),
    
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