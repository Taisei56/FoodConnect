const { Campaign, Restaurant, Application, Commission } = require('../models');

class CampaignController {
    static async createCampaign(req, res) {
        try {
            const {
                title,
                description,
                budget_per_influencer,
                meal_value,
                max_influencers,
                requirements,
                location,
                deadline
            } = req.body;

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found. Please create your profile first.'
                });
            }

            const campaign = await Campaign.create({
                restaurant_id: restaurant.id,
                title,
                description,
                budget_per_influencer: parseFloat(budget_per_influencer),
                meal_value: meal_value ? parseFloat(meal_value) : 0,
                max_influencers: max_influencers ? parseInt(max_influencers) : 1,
                requirements,
                location,
                deadline: deadline ? new Date(deadline) : null
            });

            res.status(201).json({
                message: 'Campaign created successfully',
                campaign
            });
        } catch (error) {
            console.error('Create campaign error:', error);
            res.status(500).json({
                error: 'Failed to create campaign'
            });
        }
    }

    static async getAllCampaigns(req, res) {
        try {
            const { status, location, min_budget, max_budget } = req.query;
            
            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            } else {
                filters.status = 'active';
            }
            
            if (location) {
                filters.location = location;
            }

            let campaigns = await Campaign.getAll(filters);

            if (min_budget) {
                const minBudget = parseFloat(min_budget);
                campaigns = campaigns.filter(c => c.budget_per_influencer >= minBudget);
            }

            if (max_budget) {
                const maxBudget = parseFloat(max_budget);
                campaigns = campaigns.filter(c => c.budget_per_influencer <= maxBudget);
            }

            campaigns = campaigns.map(campaign => ({
                ...campaign,
                budget_per_influencer: parseFloat(campaign.budget_per_influencer),
                meal_value: parseFloat(campaign.meal_value),
                application_count: parseInt(campaign.application_count),
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date()
            }));

            res.json({
                message: 'Campaigns retrieved successfully',
                campaigns,
                total: campaigns.length
            });
        } catch (error) {
            console.error('Get all campaigns error:', error);
            res.status(500).json({
                error: 'Failed to retrieve campaigns'
            });
        }
    }

    static async getCampaignById(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await Campaign.findById(id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const applications = await Application.getByCampaign(id);

            const campaignWithDetails = {
                ...campaign,
                budget_per_influencer: parseFloat(campaign.budget_per_influencer),
                meal_value: parseFloat(campaign.meal_value),
                applications,
                application_count: applications.length,
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date()
            };

            res.json({
                message: 'Campaign retrieved successfully',
                campaign: campaignWithDetails
            });
        } catch (error) {
            console.error('Get campaign by ID error:', error);
            res.status(500).json({
                error: 'Failed to retrieve campaign'
            });
        }
    }

    static async getMyRestaurantCampaigns(req, res) {
        try {
            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    error: 'Restaurant profile not found'
                });
            }

            const campaigns = await Campaign.getAll({ restaurant_id: restaurant.id });

            const campaignsWithDetails = campaigns.map(campaign => ({
                ...campaign,
                budget_per_influencer: parseFloat(campaign.budget_per_influencer),
                meal_value: parseFloat(campaign.meal_value),
                application_count: parseInt(campaign.application_count),
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date()
            }));

            res.json({
                message: 'Restaurant campaigns retrieved successfully',
                campaigns: campaignsWithDetails,
                total: campaignsWithDetails.length
            });
        } catch (error) {
            console.error('Get restaurant campaigns error:', error);
            res.status(500).json({
                error: 'Failed to retrieve restaurant campaigns'
            });
        }
    }

    static async updateCampaign(req, res) {
        try {
            const { id } = req.params;
            const updates = { ...req.body };

            const campaign = await Campaign.findById(id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only update your own campaigns'
                });
            }

            if (updates.budget_per_influencer) {
                updates.budget_per_influencer = parseFloat(updates.budget_per_influencer);
            }
            if (updates.meal_value) {
                updates.meal_value = parseFloat(updates.meal_value);
            }
            if (updates.max_influencers) {
                updates.max_influencers = parseInt(updates.max_influencers);
            }
            if (updates.deadline) {
                updates.deadline = new Date(updates.deadline);
            }

            const updatedCampaign = await Campaign.update(id, updates);

            res.json({
                message: 'Campaign updated successfully',
                campaign: updatedCampaign
            });
        } catch (error) {
            console.error('Update campaign error:', error);
            res.status(500).json({
                error: 'Failed to update campaign'
            });
        }
    }

    static async closeCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await Campaign.findById(id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only close your own campaigns'
                });
            }

            const updatedCampaign = await Campaign.update(id, { status: 'closed' });

            res.json({
                message: 'Campaign closed successfully',
                campaign: updatedCampaign
            });
        } catch (error) {
            console.error('Close campaign error:', error);
            res.status(500).json({
                error: 'Failed to close campaign'
            });
        }
    }

    static async completeCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await Campaign.findById(id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only complete your own campaigns'
                });
            }

            const acceptedApplications = await Application.getByCampaign(id);
            const acceptedApps = acceptedApplications.filter(app => app.status === 'accepted');

            for (const app of acceptedApps) {
                const existingCommission = await Commission.getAll({
                    campaign_id: id,
                    influencer_id: app.influencer_id
                });

                if (existingCommission.length === 0) {
                    const commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_RATE) || 15.00;
                    await Commission.create({
                        campaign_id: id,
                        restaurant_id: restaurant.id,
                        influencer_id: app.influencer_id,
                        campaign_amount: parseFloat(campaign.budget_per_influencer),
                        commission_rate: commissionRate
                    });
                }
            }

            const updatedCampaign = await Campaign.update(id, { status: 'completed' });

            res.json({
                message: 'Campaign completed successfully. Commissions have been calculated.',
                campaign: updatedCampaign
            });
        } catch (error) {
            console.error('Complete campaign error:', error);
            res.status(500).json({
                error: 'Failed to complete campaign'
            });
        }
    }

    static async deleteCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await Campaign.findById(id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only delete your own campaigns'
                });
            }

            const applications = await Application.getByCampaign(id);
            if (applications.length > 0) {
                return res.status(400).json({
                    error: 'Cannot delete campaign with existing applications. Close the campaign instead.'
                });
            }

            await Campaign.delete(id);

            res.json({
                message: 'Campaign deleted successfully'
            });
        } catch (error) {
            console.error('Delete campaign error:', error);
            res.status(500).json({
                error: 'Failed to delete campaign'
            });
        }
    }
}

module.exports = CampaignController;