const { Commission, Restaurant } = require('../models');

class CommissionController {
    static async getAllCommissions(req, res) {
        try {
            const { status } = req.query;
            
            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found'
                });
            }

            const filters = { restaurant_id: restaurant.id };
            if (status && status !== 'all') {
                filters.status = status;
            }

            const commissions = await Commission.getAll(filters);

            const commissionsWithDetails = commissions.map(commission => ({
                ...commission,
                campaign_amount: parseFloat(commission.campaign_amount),
                commission_rate: parseFloat(commission.commission_rate),
                commission_amount: parseFloat(commission.commission_amount)
            }));

            res.json({
                message: 'Commissions retrieved successfully',
                commissions: commissionsWithDetails,
                total: commissionsWithDetails.length,
                summary: {
                    total_amount: commissionsWithDetails.reduce((sum, c) => sum + c.commission_amount, 0),
                    pending: commissionsWithDetails.filter(c => c.status === 'pending').length,
                    approved: commissionsWithDetails.filter(c => c.status === 'approved').length,
                    paid: commissionsWithDetails.filter(c => c.status === 'paid').length
                }
            });
        } catch (error) {
            console.error('Get all commissions error:', error);
            res.status(500).json({
                error: 'Failed to retrieve commissions'
            });
        }
    }

    static async updateCommissionStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found'
                });
            }

            const commissions = await Commission.getAll({ 
                restaurant_id: restaurant.id 
            });
            
            const commission = commissions.find(c => c.id === parseInt(id));
            if (!commission) {
                return res.status(404).json({
                    error: 'Commission not found or access denied'
                });
            }

            const updatedCommission = await Commission.updateStatus(id, status);

            res.json({
                message: `Commission status updated to ${status}`,
                commission: {
                    ...updatedCommission,
                    campaign_amount: parseFloat(updatedCommission.campaign_amount),
                    commission_rate: parseFloat(updatedCommission.commission_rate),
                    commission_amount: parseFloat(updatedCommission.commission_amount)
                }
            });
        } catch (error) {
            console.error('Update commission status error:', error);
            res.status(500).json({
                error: 'Failed to update commission status'
            });
        }
    }

    static async getCommissionStats(req, res) {
        try {
            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found'
                });
            }

            const allCommissions = await Commission.getAll({ 
                restaurant_id: restaurant.id 
            });

            const stats = {
                total_commissions: allCommissions.length,
                total_amount: allCommissions.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0),
                pending_amount: allCommissions
                    .filter(c => c.status === 'pending')
                    .reduce((sum, c) => sum + parseFloat(c.commission_amount), 0),
                approved_amount: allCommissions
                    .filter(c => c.status === 'approved')
                    .reduce((sum, c) => sum + parseFloat(c.commission_amount), 0),
                paid_amount: allCommissions
                    .filter(c => c.status === 'paid')
                    .reduce((sum, c) => sum + parseFloat(c.commission_amount), 0),
                by_status: {
                    pending: allCommissions.filter(c => c.status === 'pending').length,
                    approved: allCommissions.filter(c => c.status === 'approved').length,
                    paid: allCommissions.filter(c => c.status === 'paid').length
                }
            };

            res.json({
                message: 'Commission statistics retrieved successfully',
                stats
            });
        } catch (error) {
            console.error('Get commission stats error:', error);
            res.status(500).json({
                error: 'Failed to retrieve commission statistics'
            });
        }
    }

    static async exportCommissions(req, res) {
        try {
            const { status, start_date, end_date } = req.query;
            
            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found'
                });
            }

            const filters = { restaurant_id: restaurant.id };
            if (status && status !== 'all') {
                filters.status = status;
            }

            let commissions = await Commission.getAll(filters);

            if (start_date) {
                commissions = commissions.filter(c => 
                    new Date(c.created_at) >= new Date(start_date)
                );
            }

            if (end_date) {
                commissions = commissions.filter(c => 
                    new Date(c.created_at) <= new Date(end_date)
                );
            }

            const csvHeaders = [
                'ID',
                'Campaign Title',
                'Influencer Name',
                'Campaign Amount (RM)',
                'Commission Rate (%)',
                'Commission Amount (RM)',
                'Status',
                'Created Date'
            ];

            const csvRows = commissions.map(c => [
                c.id,
                c.campaign_title,
                c.display_name,
                parseFloat(c.campaign_amount).toFixed(2),
                parseFloat(c.commission_rate).toFixed(2),
                parseFloat(c.commission_amount).toFixed(2),
                c.status,
                new Date(c.created_at).toLocaleDateString()
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.map(field => `"${field}"`).join(','))
                .join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=commissions.csv');
            res.send(csvContent);
        } catch (error) {
            console.error('Export commissions error:', error);
            res.status(500).json({
                error: 'Failed to export commissions'
            });
        }
    }
}

module.exports = CommissionController;