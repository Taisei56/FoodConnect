const PaymentMVP = require('../models/PaymentMVP');
const CampaignMVP = require('../models/CampaignMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const UserMVP = require('../models/UserMVP');
const emailService = require('../services/emailService');
const { body, validationResult } = require('express-validator');

class PaymentControllerMVP {
    // Payment validation
    static getPaymentValidation() {
        return [
            body('campaign_id')
                .isInt({ min: 1 })
                .withMessage('Valid campaign ID is required'),
            body('influencer_id')
                .isInt({ min: 1 })
                .withMessage('Valid influencer ID is required'),
            body('amount')
                .isFloat({ min: 10 })
                .withMessage('Payment amount must be at least RM 10')
        ];
    }

    // Create payment (when campaign is completed)
    static async createPayment(req, res) {
        try {
            console.log('🔄 Creating payment');

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { campaign_id, influencer_id, amount, application_id } = req.body;
            const user = req.user;

            // Verify user is restaurant owner
            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can create payments'
                });
            }

            // Get restaurant profile
            const restaurantModel = new RestaurantMVP();
            const restaurant = await restaurantModel.findByUserId(user.id);

            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    error: 'Restaurant profile not found'
                });
            }

            // Verify campaign belongs to restaurant
            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.findById(campaign_id);

            if (!campaign || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Campaign not found or access denied'
                });
            }

            // Verify influencer exists
            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findById(influencer_id);

            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer not found'
                });
            }

            // Check if payment already exists
            const paymentModel = new PaymentMVP();
            const existingPayments = await paymentModel.findAll({
                campaign_id: campaign_id,
                influencer_id: influencer_id
            });

            if (existingPayments.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment already exists for this campaign and influencer'
                });
            }

            // Create payment record
            const paymentData = {
                campaign_id: parseInt(campaign_id),
                restaurant_id: restaurant.id,
                influencer_id: parseInt(influencer_id),
                application_id: application_id ? parseInt(application_id) : null,
                amount: parseFloat(amount),
                status: 'pending'
            };

            const payment = await paymentModel.createPayment(paymentData);

            console.log('✅ Payment created:', {
                paymentId: payment.id,
                campaignId: campaign_id,
                amount: payment.amount,
                platformFee: payment.platform_fee
            });

            res.status(201).json({
                success: true,
                message: 'Payment created successfully',
                data: {
                    payment,
                    fee_breakdown: {
                        total_amount: payment.amount,
                        platform_fee: payment.platform_fee,
                        net_to_influencer: payment.net_amount
                    },
                    next_steps: [
                        `Transfer RM ${payment.amount} to admin account`,
                        'Include payment reference in transfer description',
                        'Admin will confirm payment and hold in escrow',
                        'Payment will be released after content approval'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Create payment error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create payment'
            });
        }
    }

    // Get payments for restaurant
    static async getRestaurantPayments(req, res) {
        try {
            const user = req.user;
            const { status, campaign_id, page = 1, limit = 10 } = req.query;

            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can access this endpoint'
                });
            }

            const restaurantModel = new RestaurantMVP();
            const restaurant = await restaurantModel.findByUserId(user.id);

            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    error: 'Restaurant profile not found'
                });
            }

            const paymentModel = new PaymentMVP();
            const filters = { restaurant_id: restaurant.id };
            if (status) filters.status = status;
            if (campaign_id) filters.campaign_id = campaign_id;

            const payments = await paymentModel.getRestaurantPayments(restaurant.id, filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedPayments = payments.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    payments: paginatedPayments,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: payments.length,
                        total_pages: Math.ceil(payments.length / limit)
                    },
                    summary: {
                        total_paid: payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
                        total_fees: payments.reduce((sum, p) => sum + (parseFloat(p.platform_fee) || 0), 0),
                        pending_count: payments.filter(p => p.status === 'pending').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get restaurant payments error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get restaurant payments'
            });
        }
    }

    // Get payments for influencer
    static async getInfluencerPayments(req, res) {
        try {
            const user = req.user;
            const { status, campaign_id, page = 1, limit = 10 } = req.query;

            if (user.user_type !== 'influencer') {
                return res.status(403).json({
                    success: false,
                    error: 'Only influencers can access this endpoint'
                });
            }

            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findByUserId(user.id);

            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            const paymentModel = new PaymentMVP();
            const filters = {};
            if (status) filters.status = status;
            if (campaign_id) filters.campaign_id = campaign_id;

            const payments = await paymentModel.getInfluencerPayments(influencer.id, filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedPayments = payments.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    payments: paginatedPayments,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: payments.length,
                        total_pages: Math.ceil(payments.length / limit)
                    },
                    summary: {
                        total_earned: payments.filter(p => p.status === 'released').reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
                        pending_earnings: payments.filter(p => ['received', 'held'].includes(p.status)).reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
                        completed_campaigns: payments.filter(p => p.status === 'released').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get influencer payments error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get influencer payments'
            });
        }
    }

    // Get single payment details
    static async getPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const user = req.user;

            const paymentModel = new PaymentMVP();
            const payment = await paymentModel.findById(paymentId);

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            // Check access permissions
            let hasAccess = false;

            if (user.user_type === 'admin') {
                hasAccess = true;
            } else if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const restaurant = await restaurantModel.findByUserId(user.id);
                hasAccess = restaurant && payment.restaurant_id === restaurant.id;
            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(user.id);
                hasAccess = influencer && payment.influencer_id === influencer.id;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            res.json({
                success: true,
                data: {
                    payment,
                    workflow: PaymentMVP.getPaymentWorkflow(),
                    status_labels: PaymentMVP.getStatusLabels()
                }
            });

        } catch (error) {
            console.error('❌ Get payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get payment'
            });
        }
    }

    // Process payment (admin only)
    static async processPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const { action, notes, transaction_reference } = req.body;
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can process payments'
                });
            }

            const validActions = ['confirm_received', 'hold_payment', 'release_payment', 'cancel_payment'];
            if (!validActions.includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be one of: ' + validActions.join(', ')
                });
            }

            const paymentModel = new PaymentMVP();
            const payment = await paymentModel.findById(paymentId);

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            let updatedPayment;
            let statusMessage;

            switch (action) {
                case 'confirm_received':
                    if (payment.status !== 'pending') {
                        return res.status(400).json({
                            success: false,
                            error: 'Payment must be pending to confirm received'
                        });
                    }
                    updatedPayment = await paymentModel.updateStatus(
                        paymentId,
                        'received',
                        notes || 'Payment confirmed received by admin',
                        transaction_reference
                    );
                    statusMessage = 'Payment confirmed as received';
                    break;

                case 'hold_payment':
                    if (payment.status !== 'received') {
                        return res.status(400).json({
                            success: false,
                            error: 'Payment must be received to hold in escrow'
                        });
                    }
                    updatedPayment = await paymentModel.updateStatus(
                        paymentId,
                        'held',
                        notes || 'Payment held in escrow pending content approval'
                    );
                    statusMessage = 'Payment held in escrow';
                    break;

                case 'release_payment':
                    if (payment.status !== 'held') {
                        return res.status(400).json({
                            success: false,
                            error: 'Payment must be held to release'
                        });
                    }
                    updatedPayment = await paymentModel.releasePayment(paymentId, notes);
                    statusMessage = 'Payment released to influencer';
                    break;

                case 'cancel_payment':
                    if (payment.status === 'released') {
                        return res.status(400).json({
                            success: false,
                            error: 'Cannot cancel released payment'
                        });
                    }
                    updatedPayment = await paymentModel.cancelPayment(paymentId, notes || 'Payment cancelled by admin');
                    statusMessage = 'Payment cancelled';
                    break;
            }

            // Send notification emails
            try {
                if (action === 'release_payment') {
                    await emailService.sendPaymentReleaseEmail(payment.influencer_email, payment);
                } else if (action === 'cancel_payment') {
                    await emailService.sendPaymentCancelledEmail(payment.restaurant_email, payment, notes);
                }
            } catch (emailError) {
                console.error('⚠️ Failed to send payment notification email:', emailError.message);
            }

            console.log(`✅ Payment ${action}:`, {
                paymentId: payment.id,
                newStatus: updatedPayment.status,
                adminId: user.id
            });

            res.json({
                success: true,
                message: statusMessage,
                data: updatedPayment
            });

        } catch (error) {
            console.error('❌ Process payment error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process payment'
            });
        }
    }

    // Calculate payment amount with fees
    static async calculatePayment(req, res) {
        try {
            const { amount } = req.query;

            if (!amount || isNaN(amount) || parseFloat(amount) < 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount (minimum RM 10) is required'
                });
            }

            const calculation = PaymentMVP.calculatePlatformFee(amount);

            res.json({
                success: true,
                data: {
                    calculation,
                    breakdown: {
                        restaurant_pays: calculation.amount,
                        platform_fee: calculation.platform_fee,
                        influencer_receives: calculation.net_amount,
                        fee_percentage: calculation.fee_percentage
                    }
                }
            });

        } catch (error) {
            console.error('❌ Calculate payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate payment'
            });
        }
    }

    // Get payment statistics (admin only)
    static async getPaymentStats(req, res) {
        try {
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can access payment statistics'
                });
            }

            const { date_from, date_to, status } = req.query;
            const filters = {};

            if (date_from) filters.date_from = date_from;
            if (date_to) filters.date_to = date_to;
            if (status) filters.status = status;

            const paymentModel = new PaymentMVP();
            const stats = await paymentModel.getStats(filters);

            // Get recent payments for activity feed
            const recentPayments = await paymentModel.findAll({
                ...filters,
                limit: 10
            });

            res.json({
                success: true,
                data: {
                    statistics: stats,
                    recent_activity: recentPayments.slice(0, 10),
                    status_labels: PaymentMVP.getStatusLabels()
                }
            });

        } catch (error) {
            console.error('❌ Get payment stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get payment statistics'
            });
        }
    }

    // Get pending payments (admin only)
    static async getPendingPayments(req, res) {
        try {
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can access pending payments'
                });
            }

            const paymentModel = new PaymentMVP();
            const pendingPayments = await paymentModel.getPendingPayments();

            res.json({
                success: true,
                data: {
                    pending_payments: pendingPayments,
                    total_count: pendingPayments.length,
                    total_pending_amount: pendingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                }
            });

        } catch (error) {
            console.error('❌ Get pending payments error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending payments'
            });
        }
    }

    // Generate payment report (admin only)
    static async generatePaymentReport(req, res) {
        try {
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can generate payment reports'
                });
            }

            const { date_from, date_to, status, format = 'json' } = req.query;
            const filters = {};

            if (date_from) filters.date_from = date_from;
            if (date_to) filters.date_to = date_to;
            if (status) filters.status = status;

            const paymentModel = new PaymentMVP();
            const report = await paymentModel.generateReport(filters);

            if (format === 'csv') {
                // Generate CSV format
                const csvHeaders = [
                    'Payment ID', 'Campaign', 'Restaurant', 'Influencer',
                    'Amount', 'Platform Fee', 'Net Amount', 'Status',
                    'Created Date', 'Transaction Reference'
                ];

                const csvRows = report.payments.map(payment => [
                    payment.id,
                    payment.campaign_title,
                    payment.restaurant,
                    payment.influencer,
                    payment.amount,
                    payment.platform_fee,
                    payment.net_amount,
                    payment.status,
                    payment.created_at,
                    payment.transaction_reference || ''
                ]);

                const csvContent = [csvHeaders, ...csvRows]
                    .map(row => row.map(field => `"${field}"`).join(','))
                    .join('\n');

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="payment_report_${Date.now()}.csv"`);
                res.send(csvContent);
            } else {
                res.json({
                    success: true,
                    data: report
                });
            }

        } catch (error) {
            console.error('❌ Generate payment report error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate payment report'
            });
        }
    }

    // Get payment instructions for restaurants
    static async getPaymentInstructions(req, res) {
        try {
            const touchNGoAccount = process.env.TOUCH_N_GO_ACCOUNT || 'admin@foodconnect.my';
            const platformFee = process.env.PLATFORM_FEE_PERCENTAGE || '15';

            res.json({
                success: true,
                data: {
                    payment_methods: [
                        {
                            name: 'Touch \'n Go eWallet',
                            account: touchNGoAccount,
                            instructions: [
                                'Open Touch \'n Go eWallet app',
                                `Transfer to: ${touchNGoAccount}`,
                                'Include payment reference in description',
                                'Screenshot and keep receipt for verification'
                            ]
                        }
                    ],
                    platform_fee: {
                        percentage: platformFee,
                        description: `Platform charges ${platformFee}% fee on total payment amount`
                    },
                    workflow: [
                        'Create campaign and get applications',
                        'Accept influencer application',
                        'Create payment for accepted influencer',
                        'Transfer payment to admin account',
                        'Admin confirms and holds payment in escrow',
                        'Influencer creates and submits content',
                        'Restaurant approves content',
                        'Admin releases payment to influencer'
                    ],
                    support: {
                        email: process.env.ADMIN_EMAIL || 'admin@foodconnect.my',
                        hours: 'Monday-Friday, 9 AM - 6 PM MYT'
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get payment instructions error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get payment instructions'
            });
        }
    }
}

module.exports = PaymentControllerMVP;