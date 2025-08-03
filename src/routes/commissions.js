const express = require('express');
const CommissionController = require('../controllers/commissionController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateId, handleValidationErrors } = require('../middleware/validation');
const { body, query } = require('express-validator');

const router = express.Router();

router.get('/', [
    authenticateToken,
    requireRole('restaurant'),
    query('status')
        .optional()
        .isIn(['all', 'pending', 'invoiced', 'paid'])
        .withMessage('Status must be all, pending, invoiced, or paid'),
    handleValidationErrors
], CommissionController.getAllCommissions);

router.put('/:id/status', [
    authenticateToken,
    requireRole('restaurant'),
    validateId,
    body('status')
        .isIn(['pending', 'invoiced', 'paid'])
        .withMessage('Status must be pending, invoiced, or paid'),
    handleValidationErrors
], CommissionController.updateCommissionStatus);

router.get('/stats', [
    authenticateToken,
    requireRole('restaurant')
], CommissionController.getCommissionStats);

router.get('/export', [
    authenticateToken,
    requireRole('restaurant'),
    query('status')
        .optional()
        .isIn(['all', 'pending', 'invoiced', 'paid'])
        .withMessage('Status must be all, pending, invoiced, or paid'),
    query('start_date')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date'),
    query('end_date')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),
    handleValidationErrors
], CommissionController.exportCommissions);

module.exports = router;