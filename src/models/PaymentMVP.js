const fs = require('fs');
const path = require('path');

class PaymentMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/payments.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    // Create payment record
    async createPayment(paymentData) {
        try {
            // Calculate platform fee and net amount
            const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '15');
            const amount = parseFloat(paymentData.amount);
            const platformFee = (amount * platformFeePercent) / 100;
            const netAmount = amount - platformFee;

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO payments (
                        campaign_id, restaurant_id, influencer_id, application_id,
                        amount, platform_fee, net_amount, status, transaction_reference
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                    [
                        paymentData.campaign_id,
                        paymentData.restaurant_id,
                        paymentData.influencer_id,
                        paymentData.application_id,
                        amount,
                        platformFee,
                        netAmount,
                        paymentData.status || 'pending',
                        paymentData.transaction_reference || null
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const payments = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1;

                const payment = {
                    id: newId,
                    campaign_id: paymentData.campaign_id,
                    restaurant_id: paymentData.restaurant_id,
                    influencer_id: paymentData.influencer_id,
                    application_id: paymentData.application_id,
                    amount: amount,
                    platform_fee: platformFee,
                    net_amount: netAmount,
                    status: paymentData.status || 'pending',
                    transaction_reference: paymentData.transaction_reference || null,
                    admin_notes: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                payments.push(payment);
                fs.writeFileSync(this.dataFile, JSON.stringify(payments, null, 2));
                return payment;
            }
        } catch (error) {
            throw new Error(`Failed to create payment: ${error.message}`);
        }
    }

    // Find payment by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT p.*, c.title as campaign_title, r.business_name, i.display_name as influencer_name
                     FROM payments p
                     JOIN campaigns c ON p.campaign_id = c.id
                     JOIN restaurants r ON p.restaurant_id = r.id
                     JOIN influencers i ON p.influencer_id = i.id
                     WHERE p.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const payments = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));

                const payment = payments.find(p => p.id === parseInt(id));
                if (payment) {
                    const campaign = campaigns.find(c => c.id === payment.campaign_id);
                    const restaurant = restaurants.find(r => r.id === payment.restaurant_id);
                    const influencer = influencers.find(i => i.id === payment.influencer_id);

                    return {
                        ...payment,
                        campaign_title: campaign?.title,
                        business_name: restaurant?.business_name,
                        influencer_name: influencer?.display_name
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Error finding payment by ID:', error);
            return null;
        }
    }

    // Get all payments with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT p.*, c.title as campaign_title, r.business_name, i.display_name as influencer_name,
                           ru.email as restaurant_email, iu.email as influencer_email
                    FROM payments p
                    JOIN campaigns c ON p.campaign_id = c.id
                    JOIN restaurants r ON p.restaurant_id = r.id
                    JOIN influencers i ON p.influencer_id = i.id
                    JOIN users ru ON r.user_id = ru.id
                    JOIN users iu ON i.user_id = iu.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`p.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.campaign_id) {
                    conditions.push(`p.campaign_id = $${values.length + 1}`);
                    values.push(filters.campaign_id);
                }

                if (filters.restaurant_id) {
                    conditions.push(`p.restaurant_id = $${values.length + 1}`);
                    values.push(filters.restaurant_id);
                }

                if (filters.influencer_id) {
                    conditions.push(`p.influencer_id = $${values.length + 1}`);
                    values.push(filters.influencer_id);
                }

                if (filters.date_from) {
                    conditions.push(`p.created_at >= $${values.length + 1}`);
                    values.push(filters.date_from);
                }

                if (filters.date_to) {
                    conditions.push(`p.created_at <= $${values.length + 1}`);
                    values.push(filters.date_to);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY p.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const payments = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with related data
                const paymentsWithDetails = payments.map(payment => {
                    const campaign = campaigns.find(c => c.id === payment.campaign_id);
                    const restaurant = restaurants.find(r => r.id === payment.restaurant_id);
                    const influencer = influencers.find(i => i.id === payment.influencer_id);
                    const restaurantUser = restaurant ? users.find(u => u.id === restaurant.user_id) : null;
                    const influencerUser = influencer ? users.find(u => u.id === influencer.user_id) : null;

                    return {
                        ...payment,
                        campaign_title: campaign?.title,
                        business_name: restaurant?.business_name,
                        influencer_name: influencer?.display_name,
                        restaurant_email: restaurantUser?.email,
                        influencer_email: influencerUser?.email
                    };
                });

                let filtered = paymentsWithDetails;

                if (filters.status) {
                    filtered = filtered.filter(p => p.status === filters.status);
                }

                if (filters.campaign_id) {
                    filtered = filtered.filter(p => p.campaign_id === parseInt(filters.campaign_id));
                }

                if (filters.restaurant_id) {
                    filtered = filtered.filter(p => p.restaurant_id === parseInt(filters.restaurant_id));
                }

                if (filters.influencer_id) {
                    filtered = filtered.filter(p => p.influencer_id === parseInt(filters.influencer_id));
                }

                if (filters.date_from) {
                    filtered = filtered.filter(p => new Date(p.created_at) >= new Date(filters.date_from));
                }

                if (filters.date_to) {
                    filtered = filtered.filter(p => new Date(p.created_at) <= new Date(filters.date_to));
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find payments: ${error.message}`);
        }
    }

    // Update payment status
    async updateStatus(id, status, adminNotes = null, transactionReference = null) {
        try {
            try {
                const db = require('../config/database');
                const updateData = { status };
                const setClause = ['status = $1'];
                const values = [status];

                if (adminNotes) {
                    setClause.push(`admin_notes = $${values.length + 1}`);
                    values.push(adminNotes);
                }

                if (transactionReference) {
                    setClause.push(`transaction_reference = $${values.length + 1}`);
                    values.push(transactionReference);
                }

                values.push(id);

                const result = await db.query(
                    `UPDATE payments SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const payments = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = payments.findIndex(p => p.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Payment not found');
                }

                payments[index].status = status;
                if (adminNotes) payments[index].admin_notes = adminNotes;
                if (transactionReference) payments[index].transaction_reference = transactionReference;
                payments[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(payments, null, 2));
                return payments[index];
            }
        } catch (error) {
            throw new Error(`Failed to update payment status: ${error.message}`);
        }
    }

    // Get payment statistics
    async getStats(filters = {}) {
        try {
            const payments = await this.findAll(filters);

            const stats = {
                total_payments: payments.length,
                by_status: {
                    pending: 0,
                    received: 0,
                    held: 0,
                    released: 0,
                    cancelled: 0
                },
                total_amount: 0,
                total_platform_fees: 0,
                total_net_amount: 0,
                average_payment: 0,
                recent_payments: 0 // last 7 days
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            payments.forEach(payment => {
                if (payment.status) {
                    stats.by_status[payment.status]++;
                }

                stats.total_amount += parseFloat(payment.amount) || 0;
                stats.total_platform_fees += parseFloat(payment.platform_fee) || 0;
                stats.total_net_amount += parseFloat(payment.net_amount) || 0;

                if (new Date(payment.created_at) > weekAgo) {
                    stats.recent_payments++;
                }
            });

            stats.average_payment = payments.length > 0 ? stats.total_amount / payments.length : 0;

            return stats;
        } catch (error) {
            throw new Error(`Failed to get payment stats: ${error.message}`);
        }
    }

    // Get payments for restaurant
    async getRestaurantPayments(restaurantId, filters = {}) {
        const combinedFilters = { ...filters, restaurant_id: restaurantId };
        return await this.findAll(combinedFilters);
    }

    // Get payments for influencer
    async getInfluencerPayments(influencerId, filters = {}) {
        const combinedFilters = { ...filters, influencer_id: influencerId };
        return await this.findAll(combinedFilters);
    }

    // Get campaign payments
    async getCampaignPayments(campaignId) {
        return await this.findAll({ campaign_id: campaignId });
    }

    // Get pending payments
    async getPendingPayments() {
        return await this.findAll({ status: 'pending' });
    }

    // Process Touch 'n Go payment (placeholder)
    async processTouchNGoPayment(paymentId, touchNGoDetails) {
        try {
            // This is a placeholder for Touch 'n Go integration
            // In real implementation, you would integrate with Touch 'n Go API

            const payment = await this.findById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }

            // Simulate payment processing
            const transactionReference = `TNG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Update payment status
            const updatedPayment = await this.updateStatus(
                paymentId,
                'received',
                'Payment processed via Touch n Go eWallet',
                transactionReference
            );

            return {
                success: true,
                payment: updatedPayment,
                transaction_reference: transactionReference,
                provider: 'Touch n Go eWallet'
            };

        } catch (error) {
            throw new Error(`Failed to process Touch n Go payment: ${error.message}`);
        }
    }

    // Release payment to influencer (admin action)
    async releasePayment(paymentId, adminNotes = null) {
        try {
            const payment = await this.findById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status !== 'held') {
                throw new Error('Payment must be in held status to release');
            }

            const updatedPayment = await this.updateStatus(
                paymentId,
                'released',
                adminNotes || 'Payment released to influencer'
            );

            return updatedPayment;
        } catch (error) {
            throw new Error(`Failed to release payment: ${error.message}`);
        }
    }

    // Cancel payment
    async cancelPayment(paymentId, reason) {
        try {
            const payment = await this.findById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status === 'released') {
                throw new Error('Cannot cancel released payment');
            }

            const updatedPayment = await this.updateStatus(
                paymentId,
                'cancelled',
                reason
            );

            return updatedPayment;
        } catch (error) {
            throw new Error(`Failed to cancel payment: ${error.message}`);
        }
    }

    // Generate payment report
    async generateReport(filters = {}) {
        try {
            const payments = await this.findAll(filters);
            const stats = await this.getStats(filters);

            return {
                summary: stats,
                payments: payments.map(payment => ({
                    id: payment.id,
                    campaign_title: payment.campaign_title,
                    restaurant: payment.business_name,
                    influencer: payment.influencer_name,
                    amount: payment.amount,
                    platform_fee: payment.platform_fee,
                    net_amount: payment.net_amount,
                    status: payment.status,
                    created_at: payment.created_at,
                    transaction_reference: payment.transaction_reference
                })),
                generated_at: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to generate payment report: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'pending': 'Pending Payment',
            'received': 'Payment Received',
            'held': 'Payment Held (Escrow)',
            'released': 'Payment Released',
            'cancelled': 'Payment Cancelled'
        };
    }

    // Get payment workflow steps
    static getPaymentWorkflow() {
        return [
            {
                status: 'pending',
                description: 'Restaurant needs to transfer payment to admin account',
                actor: 'Restaurant',
                next_status: 'received'
            },
            {
                status: 'received',
                description: 'Admin confirms payment received and holds in escrow',
                actor: 'Admin',
                next_status: 'held'
            },
            {
                status: 'held',
                description: 'Content created and approved, ready for release',
                actor: 'Admin',
                next_status: 'released'
            },
            {
                status: 'released',
                description: 'Payment transferred to influencer',
                actor: 'Admin',
                next_status: null
            }
        ];
    }

    // Calculate platform fee
    static calculatePlatformFee(amount, feePercent = null) {
        const percentage = feePercent || parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '15');
        const fee = (parseFloat(amount) * percentage) / 100;
        return {
            amount: parseFloat(amount),
            platform_fee: fee,
            net_amount: parseFloat(amount) - fee,
            fee_percentage: percentage
        };
    }
}

module.exports = PaymentMVP;