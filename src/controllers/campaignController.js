const Campaign = require('../models/Campaign');
const Restaurant = require('../models/Restaurant');
const Influencer = require('../models/Influencer');

class CampaignController {
    static async createCampaign(req, res) {
        try {
            const {
                title,
                description,
                brief,
                total_budget,
                deadline,
                location,
                dietary_categories,
                target_tiers,
                max_influencers,
                budget_allocations
            } = req.body;

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    error: 'Restaurant profile not found. Please create your profile first.'
                });
            }

            // Validate budget allocations if provided
            let parsedBudgetAllocations = [];
            if (budget_allocations) {
                try {
                    parsedBudgetAllocations = typeof budget_allocations === 'string' 
                        ? JSON.parse(budget_allocations) 
                        : budget_allocations;
                } catch (e) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid budget allocations format'
                    });
                }
            }

            // Parse dietary categories and target tiers
            let parsedDietaryCategories = [];
            let parsedTargetTiers = [];

            if (dietary_categories) {
                try {
                    parsedDietaryCategories = Array.isArray(dietary_categories) 
                        ? dietary_categories 
                        : JSON.parse(dietary_categories);
                } catch (e) {
                    parsedDietaryCategories = [dietary_categories];
                }
            }

            if (target_tiers) {
                try {
                    parsedTargetTiers = Array.isArray(target_tiers) 
                        ? target_tiers 
                        : JSON.parse(target_tiers);
                } catch (e) {
                    parsedTargetTiers = [target_tiers];
                }
            }

            const campaign = await (new Campaign()).create({
                restaurant_id: restaurant.id,
                title: title || '',
                description: description || '',
                brief: brief || '',
                total_budget: parseFloat(total_budget) || 0,
                deadline: deadline ? new Date(deadline) : null,
                location: location || '',
                dietary_categories: parsedDietaryCategories,
                target_tiers: parsedTargetTiers,
                max_influencers: max_influencers ? parseInt(max_influencers) : 5,
                budget_allocations: parsedBudgetAllocations,
                status: 'draft'
            });

            res.status(201).json({
                success: true,
                message: 'Campaign created successfully',
                campaign,
                status_labels: Campaign.getStatusLabels(),
                dietary_categories: Restaurant.getDietaryCategories(),
                dietary_labels: Restaurant.getDietaryCategoryLabels(),
                tier_labels: Influencer.getTierLabels()
            });
        } catch (error) {
            console.error('Create campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create campaign'
            });
        }
    }

    static async getAllCampaigns(req, res) {
        try {
            const { 
                status, 
                location, 
                tier, 
                dietary_categories,
                min_budget, 
                max_budget,
                page = 1 
            } = req.query;
            
            const limit = 12;
            const offset = (page - 1) * limit;
            
            const filters = {};
            if (status && status !== 'all') {
                filters.status = status;
            } else {
                filters.status = 'published'; // Default to published campaigns
            }
            
            if (location) {
                filters.location = location;
            }

            if (tier) {
                filters.target_tiers = [tier];
            }

            let campaigns = await (new Campaign()).findAll(filters);

            // Additional filtering
            if (dietary_categories) {
                const requestedCategories = dietary_categories.split(',');
                campaigns = campaigns.filter(c => {
                    if (!c.dietary_categories || c.dietary_categories.length === 0) return false;
                    return requestedCategories.some(cat => c.dietary_categories.includes(cat));
                });
            }

            if (min_budget) {
                const minBudget = parseFloat(min_budget);
                campaigns = campaigns.filter(c => parseFloat(c.total_budget) >= minBudget);
            }

            if (max_budget) {
                const maxBudget = parseFloat(max_budget);
                campaigns = campaigns.filter(c => parseFloat(c.total_budget) <= maxBudget);
            }

            const total = campaigns.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedCampaigns = campaigns.slice(offset, offset + limit);

            // Enrich campaign data
            const enrichedCampaigns = paginatedCampaigns.map(campaign => ({
                ...campaign,
                total_budget: parseFloat(campaign.total_budget),
                application_count: campaign.application_count || 0,
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date(),
                status_label: Campaign.getStatusLabels()[campaign.status],
                dietary_labels: (campaign.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                tier_labels: (campaign.target_tiers || [])
                    .map(tier => Influencer.getTierLabels()[tier])
                    .filter(Boolean),
                days_remaining: campaign.deadline 
                    ? Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null
            }));

            res.json({
                success: true,
                message: 'Campaigns retrieved successfully',
                campaigns: enrichedCampaigns,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: {
                    status_labels: Campaign.getStatusLabels(),
                    dietary_categories: Restaurant.getDietaryCategories(),
                    dietary_labels: Restaurant.getDietaryCategoryLabels(),
                    tier_labels: Influencer.getTierLabels()
                }
            });
        } catch (error) {
            console.error('Get all campaigns error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve campaigns'
            });
        }
    }

    static async getCampaignById(req, res) {
        try {
            const { id } = req.params;
            
            const campaign = await (new Campaign()).findById(id, true);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            // Enrich campaign data
            const enrichedCampaign = {
                ...campaign,
                total_budget: parseFloat(campaign.total_budget),
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date(),
                status_label: Campaign.getStatusLabels()[campaign.status],
                dietary_labels: (campaign.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                tier_labels: (campaign.target_tiers || [])
                    .map(tier => Influencer.getTierLabels()[tier])
                    .filter(Boolean),
                days_remaining: campaign.deadline 
                    ? Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null,
                budget_breakdown: campaign.budget_allocations || []
            };

            res.json({
                success: true,
                message: 'Campaign retrieved successfully',
                campaign: enrichedCampaign
            });
        } catch (error) {
            console.error('Get campaign by ID error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve campaign'
            });
        }
    }

    static async getMyRestaurantCampaigns(req, res) {
        try {
            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    error: 'Restaurant profile not found'
                });
            }

            const campaigns = await (new Campaign()).findAll({ restaurant_id: restaurant.id });

            const campaignsWithDetails = campaigns.map(campaign => ({
                ...campaign,
                total_budget: parseFloat(campaign.total_budget),
                application_count: campaign.application_count || 0,
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date(),
                status_label: Campaign.getStatusLabels()[campaign.status],
                dietary_labels: (campaign.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                tier_labels: (campaign.target_tiers || [])
                    .map(tier => Influencer.getTierLabels()[tier])
                    .filter(Boolean),
                days_remaining: campaign.deadline 
                    ? Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null
            }));

            res.json({
                success: true,
                message: 'Restaurant campaigns retrieved successfully',
                campaigns: campaignsWithDetails,
                total: campaignsWithDetails.length,
                status_labels: Campaign.getStatusLabels()
            });
        } catch (error) {
            console.error('Get restaurant campaigns error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve restaurant campaigns'
            });
        }
    }

    static async updateCampaign(req, res) {
        try {
            const { id } = req.params;
            const updates = { ...req.body };

            const campaign = await (new Campaign()).findById(id);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only update your own campaigns'
                });
            }

            // Parse and validate updates
            if (updates.total_budget) {
                updates.total_budget = parseFloat(updates.total_budget);
            }
            if (updates.max_influencers) {
                updates.max_influencers = parseInt(updates.max_influencers);
            }
            if (updates.deadline) {
                updates.deadline = new Date(updates.deadline);
            }

            // Handle arrays
            if (updates.dietary_categories) {
                try {
                    updates.dietary_categories = Array.isArray(updates.dietary_categories) 
                        ? updates.dietary_categories 
                        : JSON.parse(updates.dietary_categories);
                } catch (e) {
                    updates.dietary_categories = [updates.dietary_categories];
                }
            }

            if (updates.target_tiers) {
                try {
                    updates.target_tiers = Array.isArray(updates.target_tiers) 
                        ? updates.target_tiers 
                        : JSON.parse(updates.target_tiers);
                } catch (e) {
                    updates.target_tiers = [updates.target_tiers];
                }
            }

            const updatedCampaign = await (new Campaign()).update(id, updates);

            res.json({
                success: true,
                message: 'Campaign updated successfully',
                campaign: {
                    ...updatedCampaign,
                    status_label: Campaign.getStatusLabels()[updatedCampaign.status]
                }
            });
        } catch (error) {
            console.error('Update campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update campaign'
            });
        }
    }

    static async publishCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await (new Campaign()).findById(id);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only publish your own campaigns'
                });
            }

            if (campaign.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: 'Only draft campaigns can be published'
                });
            }

            const updatedCampaign = await (new Campaign()).publish(id);

            res.json({
                success: true,
                message: 'Campaign published successfully',
                campaign: {
                    ...updatedCampaign,
                    status_label: Campaign.getStatusLabels()[updatedCampaign.status]
                }
            });
        } catch (error) {
            console.error('Publish campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to publish campaign'
            });
        }
    }

    static async startCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await (new Campaign()).findById(id);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only start your own campaigns'
                });
            }

            if (!['published', 'applications_open'].includes(campaign.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign cannot be started in its current status'
                });
            }

            const updatedCampaign = await (new Campaign()).start(id);

            res.json({
                success: true,
                message: 'Campaign started successfully',
                campaign: {
                    ...updatedCampaign,
                    status_label: Campaign.getStatusLabels()[updatedCampaign.status]
                }
            });
        } catch (error) {
            console.error('Start campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to start campaign'
            });
        }
    }

    static async completeCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await (new Campaign()).findById(id);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only complete your own campaigns'
                });
            }

            if (campaign.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: 'Only campaigns in progress can be completed'
                });
            }

            const updatedCampaign = await (new Campaign()).complete(id);

            res.json({
                success: true,
                message: 'Campaign completed successfully',
                campaign: {
                    ...updatedCampaign,
                    status_label: Campaign.getStatusLabels()[updatedCampaign.status]
                }
            });
        } catch (error) {
            console.error('Complete campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to complete campaign'
            });
        }
    }

    static async deleteCampaign(req, res) {
        try {
            const { id } = req.params;

            const campaign = await (new Campaign()).findById(id);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            const restaurant = await (new Restaurant()).findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own campaigns'
                });
            }

            if (campaign.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: 'Only draft campaigns can be deleted'
                });
            }

            await (new Campaign()).delete(id);

            res.json({
                success: true,
                message: 'Campaign deleted successfully'
            });
        } catch (error) {
            console.error('Delete campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete campaign'
            });
        }
    }

    static async getCampaignStats(req, res) {
        try {
            let restaurantId = null;
            
            // If user is a restaurant, filter by their campaigns
            if (req.user.user_type === 'restaurant') {
                const restaurant = await (new Restaurant()).findByUserId(req.user.id);
                if (!restaurant) {
                    return res.status(404).json({
                        success: false,
                        error: 'Restaurant profile not found'
                    });
                }
                restaurantId = restaurant.id;
            }

            const stats = await (new Campaign()).getStats(restaurantId);

            res.json({
                success: true,
                message: 'Campaign statistics retrieved successfully',
                stats: {
                    ...stats,
                    status_labels: Campaign.getStatusLabels()
                }
            });
        } catch (error) {
            console.error('Get campaign stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve campaign statistics'
            });
        }
    }

    static async getAvailableCampaignsForInfluencer(req, res) {
        try {
            const influencer = await (new Influencer()).findByUserId(req.user.id);
            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            const { location, dietary_categories, page = 1 } = req.query;
            const limit = 12;
            const offset = (page - 1) * limit;

            const filters = {};
            if (location) filters.location = location;

            const availableCampaigns = await (new Campaign()).getAvailableForInfluencer(influencer.id, filters);
            
            // Additional filtering
            let filtered = availableCampaigns;
            if (dietary_categories) {
                const requestedCategories = dietary_categories.split(',');
                filtered = filtered.filter(c => {
                    if (!c.dietary_categories || c.dietary_categories.length === 0) return false;
                    return requestedCategories.some(cat => c.dietary_categories.includes(cat));
                });
            }

            const total = filtered.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedCampaigns = filtered.slice(offset, offset + limit);

            // Enrich campaign data
            const enrichedCampaigns = paginatedCampaigns.map(campaign => ({
                ...campaign,
                total_budget: parseFloat(campaign.total_budget),
                is_expired: campaign.deadline && new Date(campaign.deadline) < new Date(),
                status_label: Campaign.getStatusLabels()[campaign.status],
                dietary_labels: (campaign.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                tier_labels: (campaign.target_tiers || [])
                    .map(tier => Influencer.getTierLabels()[tier])
                    .filter(Boolean),
                days_remaining: campaign.deadline 
                    ? Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null,
                can_apply: campaign.target_tiers.includes(influencer.tier) || campaign.target_tiers.length === 0
            }));

            res.json({
                success: true,
                message: 'Available campaigns retrieved successfully',
                campaigns: enrichedCampaigns,
                influencer_tier: influencer.tier,
                tier_label: Influencer.getTierLabels()[influencer.tier],
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error('Get available campaigns for influencer error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve available campaigns'
            });
        }
    }
}

module.exports = CampaignController;