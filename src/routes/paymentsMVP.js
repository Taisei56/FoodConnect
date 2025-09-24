const express = require('express');
const router = express.Router();
const paymentControllerMVP = require('../controllers/paymentControllerMVP');
const authControllerMVP = require('../controllers/authControllerMVP');
const { body } = require('express-validator');

// Create payment
router.post('/create',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    paymentControllerMVP.createPayment
);

// Get restaurant payments
router.get('/restaurant',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    paymentControllerMVP.getRestaurantPayments
);

// Get influencer payments
router.get('/influencer',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('influencer'),
    paymentControllerMVP.getInfluencerPayments
);

// Get payment details
router.get('/:id',
    authControllerMVP.requireAuth,
    paymentControllerMVP.getPayment
);

// Process payment (admin)
router.post('/:id/process',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('admin'),
    paymentControllerMVP.processPayment
);

// Calculate payment amount
router.post('/calculate',
    authControllerMVP.requireAuth,
    paymentControllerMVP.calculatePayment
);

// Get payment statistics
router.get('/stats/overview',
    authControllerMVP.requireAuth,
    paymentControllerMVP.getPaymentStats
);

// Get pending payments (admin)
router.get('/admin/pending',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('admin'),
    paymentControllerMVP.getPendingPayments
);

// Generate payment report
router.get('/reports/generate',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('admin'),
    paymentControllerMVP.generatePaymentReport
);

// Get payment instructions
router.get('/instructions/touch-n-go',
    authControllerMVP.requireAuth,
    paymentControllerMVP.getPaymentInstructions
);

module.exports = router;