const CampaignMVP = require('../models/CampaignMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const { body, validationResult } = require('express-validator');

class CampaignControllerMVP {
    // Campaign creation validation
    static getCampaignValidation() {
        return [
            body('title')
                .trim()
                .isLength({ min: 5, max: 100 })
                .withMessage('Campaign title must be between 5 and 100 characters'),
            body('description')
                .trim()
                .isLength({ min: 20, max: 500 })
                .withMessage('Campaign description must be between 20 and 500 characters'),
            body('brief')
                .trim()
                .isLength({ min: 50 })
                .withMessage('Campaign brief must be at least 50 characters'),
            body('total_budget')
                .isFloat({ min: 100 })
                .withMessage('Total budget must be at least RM 100'),
            body('deadline')
                .isISO8601()
                .toDate()
                .custom((value) => {
                    if (value <= new Date()) {
                        throw new Error('Deadline must be in the future');
                    }
                    const maxDate = new Date();
                    maxDate.setDate(maxDate.getDate() + 60);
                    if (value > maxDate) {
                        throw new Error('Deadline cannot be more than 60 days in the future');
                    }
                    return true;
                }),
            body('location')
                .trim()
                .notEmpty()
                .withMessage('Location is required'),
            body('max_influencers')
                .optional()
                .isInt({ min: 1, max: 20 })
                .withMessage('Maximum influencers must be between 1 and 20')
        ];
    }

    // Create campaign
    static async createCampaign(req, res) {
        try {
            console.log('🔄 Campaign creation started');

            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const user = req.user;

            // Verify user is a restaurant
            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can create campaigns'
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

            // Prepare campaign data
            const campaignData = {
                restaurant_id: restaurant.id,
                title: req.body.title,
                description: req.body.description,
                brief: req.body.brief,
                total_budget: parseFloat(req.body.total_budget),
                deadline: req.body.deadline,
                location: req.body.location,
                dietary_categories: req.body.dietary_categories || [],
                target_tiers: req.body.target_tiers || [],
                max_influencers: req.body.max_influencers || 5,
                status: req.body.publish_immediately ? 'published' : 'draft',
                budget_allocations: req.body.budget_allocations || []
            };

            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.create(campaignData);

            console.log('✅ Campaign created:', {
                campaignId: campaign.id,
                restaurantId: restaurant.id,
                status: campaign.status
            });

            res.status(201).json({
                success: true,
                message: `Campaign ${campaign.status === 'published' ? 'created and published' : 'saved as draft'} successfully`,
                data: {
                    campaign,
                    next_steps: campaign.status === 'draft' ? [
                        'Review your campaign details',
                        'Set budget allocations for different influencer tiers',
                        'Publish when ready to receive applications'
                    ] : [
                        'Campaign is now live and accepting applications',
                        'Monitor applications in your dashboard',
                        'Review and approve suitable influencers'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Create campaign error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create campaign'
            });
        }
    }

    // Save campaign as draft
    static async saveDraft(req, res) {
        try {
            console.log('🔄 Saving campaign draft');

            const user = req.user;

            // Verify user is a restaurant
            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can create campaigns'
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

            // Prepare draft campaign data with minimal validation
            const campaignData = {
                restaurant_id: restaurant.id,
                title: req.body.title || 'Draft Campaign',
                description: req.body.description || '',
                brief: req.body.brief || '',
                total_budget: parseFloat(req.body.total_budget) || 0,
                deadline: req.body.deadline || null,
                location: req.body.location || '',
                dietary_categories: req.body.dietary_categories || [],
                target_tiers: req.body.target_tiers || [],
                max_influencers: req.body.max_influencers || 5,
                status: 'draft',
                budget_allocations: req.body.budget_allocations || []
            };

            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.create(campaignData);

            console.log('✅ Campaign draft saved:', campaign.id);

            res.status(201).json({
                success: true,
                message: 'Campaign draft saved successfully',
                data: { campaign }
            });

        } catch (error) {
            console.error('❌ Save draft error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to save campaign draft'
            });
        }
    }

    // Get campaigns for restaurant
    static async getRestaurantCampaigns(req, res) {
        try {
            const user = req.user;
            const { status, page = 1, limit = 10 } = req.query;

            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can access this endpoint'
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

            const campaignModel = new CampaignMVP();
            const filters = { restaurant_id: restaurant.id };
            if (status) filters.status = status;

            const campaigns = await campaignModel.findAll(filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedCampaigns = campaigns.slice(startIndex, endIndex);

            // Get application counts for each campaign
            const campaignsWithStats = await Promise.all(
                paginatedCampaigns.map(async (campaign) => {
                    const applications = await campaignModel.getApplications(campaign.id);
                    return {
                        ...campaign,
                        application_stats: {
                            total: applications.length,
                            pending: applications.filter(app => app.status === 'pending').length,
                            accepted: applications.filter(app => app.status === 'accepted').length,
                            rejected: applications.filter(app => app.status === 'rejected').length
                        }
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    campaigns: campaignsWithStats,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: campaigns.length,
                        total_pages: Math.ceil(campaigns.length / limit)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get restaurant campaigns error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get campaigns'
            });
        }
    }

    // Get single campaign details
    static async getCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const user = req.user;

            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            // Check access permissions
            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const restaurant = await restaurantModel.findByUserId(user.id);
                if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied'
                    });
                }
            }

            // Get budget allocations
            const budgetAllocations = await campaignModel.getBudgetAllocations(campaignId);

            // Get applications if user is restaurant or admin
            let applications = null;
            if (user.user_type === 'restaurant' || user.user_type === 'admin') {
                applications = await campaignModel.getApplications(campaignId);
            }

            res.json({
                success: true,
                data: {
                    campaign,
                    budget_allocations: budgetAllocations,
                    applications
                }
            });

        } catch (error) {
            console.error('❌ Get campaign error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get campaign'
            });
        }
    }

    // Update campaign
    static async updateCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const user = req.user;

            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            // Check permissions
            if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const restaurant = await restaurantModel.findByUserId(user.id);
                if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied'
                    });
                }

                // Prevent editing published campaigns with applications
                if (campaign.status !== 'draft') {
                    const applications = await campaignModel.getApplications(campaignId);
                    if (applications.length > 0) {
                        return res.status(400).json({
                            success: false,
                            error: 'Cannot edit campaign that already has applications'
                        });
                    }
                }
            }

            const updateData = {};
            const allowedFields = [
                'title', 'description', 'brief', 'total_budget', 'deadline',
                'location', 'dietary_categories', 'target_tiers', 'max_influencers', 'status'
            ];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const updatedCampaign = await campaignModel.update(campaignId, updateData);

            console.log('✅ Campaign updated:', {
                campaignId,
                updatedFields: Object.keys(updateData)
            });

            res.json({
                success: true,
                message: 'Campaign updated successfully',
                data: updatedCampaign
            });

        } catch (error) {
            console.error('❌ Update campaign error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update campaign'
            });
        }
    }

    // Get published campaigns for influencers
    static async getPublishedCampaigns(req, res) {
        try {
            const {
                city,
                state,
                dietary_category,
                target_tier,
                min_budget,
                max_budget,
                search,
                page = 1,
                limit = 10
            } = req.query;

            const campaignModel = new CampaignMVP();
            const filters = { status: 'published' };

            if (city) filters.city = city;
            if (state) filters.state = state;
            if (dietary_category) filters.dietary_category = dietary_category;
            if (target_tier) filters.target_tier = target_tier;
            if (min_budget) filters.min_budget = parseFloat(min_budget);
            if (max_budget) filters.max_budget = parseFloat(max_budget);

            let campaigns = await campaignModel.findAll(filters);

            // Search functionality
            if (search) {
                campaigns = await campaignModel.search(search, filters);
            }

            // Filter out expired campaigns
            const now = new Date();
            campaigns = campaigns.filter(campaign => new Date(campaign.deadline) > now);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedCampaigns = campaigns.slice(startIndex, endIndex);

            // Add application status for current user if influencer
            let campaignsWithUserStatus = paginatedCampaigns;
            if (req.user?.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(req.user.id);

                campaignsWithUserStatus = await Promise.all(
                    paginatedCampaigns.map(async (campaign) => {
                        const applications = await campaignModel.getApplications(campaign.id, {
                            influencer_id: influencer?.id
                        });
                        return {
                            ...campaign,
                            user_application_status: applications.length > 0 ? applications[0].status : null,
                            can_apply: applications.length === 0 && influencer
                        };
                    })
                );
            }

            res.json({
                success: true,
                data: {
                    campaigns: campaignsWithUserStatus,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: campaigns.length,
                        total_pages: Math.ceil(campaigns.length / limit)
                    },
                    filters: {
                        city, state, dietary_category, target_tier,
                        min_budget, max_budget, search
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get published campaigns error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get campaigns'
            });
        }
    }

    // Apply to campaign (influencer)
    static async applyToCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { message, proposed_timeline, portfolio_examples } = req.body;
            const user = req.user;

            if (user.user_type !== 'influencer') {
                return res.status(403).json({
                    success: false,
                    error: 'Only influencers can apply to campaigns'
                });
            }

            // Get influencer profile
            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findByUserId(user.id);

            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            // Check if user is approved
            if (user.status !== 'approved') {
                return res.status(403).json({
                    success: false,
                    error: 'Your account must be approved before applying to campaigns'
                });
            }

            const campaignModel = new CampaignMVP();
            const campaign = await campaignModel.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            if (campaign.status !== 'published') {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign is not accepting applications'
                });
            }

            // Check if deadline has passed
            if (new Date(campaign.deadline) <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign deadline has passed'
                });
            }

            // Check if already applied
            const existingApplications = await campaignModel.getApplications(campaignId, {
                influencer_id: influencer.id
            });

            if (existingApplications.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'You have already applied to this campaign'
                });
            }

            // Check if influencer tier matches campaign requirements
            if (campaign.target_tiers && campaign.target_tiers.length > 0) {
                if (!campaign.target_tiers.includes(influencer.tier)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Your influencer tier does not match this campaign requirements'
                    });
                }
            }

            // Create application
            const applicationData = {
                campaign_id: parseInt(campaignId),
                influencer_id: influencer.id,
                message: message || '',
                proposed_timeline: proposed_timeline || '',
                portfolio_examples: portfolio_examples || []
            };

            const application = await campaignModel.createApplication(applicationData);

            console.log('✅ Application created:', {
                applicationId: application.id,
                campaignId,
                influencerId: influencer.id
            });

            res.status(201).json({
                success: true,
                message: 'Application submitted successfully',
                data: {
                    application,
                    next_steps: [
                        'Your application has been sent to the restaurant',
                        'You will receive an email notification when the restaurant reviews your application',
                        'Check your dashboard for application status updates'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Apply to campaign error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to submit application'
            });
        }
    }

    // Process application (restaurant)
    static async processApplication(req, res) {
        try {
            const { applicationId } = req.params;
            const { action } = req.body; // 'accept' or 'reject'
            const user = req.user;

            if (!['accept', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be either accept or reject'
                });
            }

            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can process applications'
                });
            }

            const campaignModel = new CampaignMVP();

            // Get application details first
            const applications = await campaignModel.getApplications(null, { application_id: applicationId });

            if (applications.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Application not found'
                });
            }

            const application = applications[0];

            // Verify campaign belongs to restaurant
            const campaign = await campaignModel.findById(application.campaign_id);
            const restaurantModel = new RestaurantMVP();
            const restaurant = await restaurantModel.findByUserId(user.id);

            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const newStatus = action === 'accept' ? 'accepted' : 'rejected';
            const updatedApplication = await campaignModel.updateApplicationStatus(applicationId, newStatus);

            console.log(`✅ Application ${action}ed:`, {
                applicationId,
                campaignId: application.campaign_id,
                influencerId: application.influencer_id,
                restaurantId: restaurant.id
            });

            res.json({
                success: true,
                message: `Application ${action}ed successfully`,
                data: updatedApplication
            });

        } catch (error) {
            console.error('❌ Process application error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process application'
            });
        }
    }

    // Get application details
    static async getApplication(req, res) {
        try {
            const { applicationId } = req.params;
            const user = req.user;

            const campaignModel = new CampaignMVP();

            // This is a placeholder - in real implementation, we'd have a getApplicationById method
            res.json({
                success: true,
                message: 'Get application endpoint - to be implemented'
            });

        } catch (error) {
            console.error('❌ Get application error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get application'
            });
        }
    }

    // Get influencer's applications
    static async getInfluencerApplications(req, res) {
        try {
            const user = req.user;
            const { status, page = 1, limit = 10 } = req.query;

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

            // For now, return placeholder data
            res.json({
                success: true,
                data: {
                    applications: [],
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: 0,
                        total_pages: 0
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get influencer applications error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get applications'
            });
        }
    }

    // Get form data for campaign creation
    static async getCampaignFormData(req, res) {
        res.json({
            success: true,
            data: {
                dietary_categories: CampaignMVP.getDietaryCategories(),
                influencer_tiers: CampaignMVP.getInfluencerTiers(),
                campaign_statuses: CampaignMVP.getStatusLabels(),
                malaysian_states: RestaurantMVP.getMalaysianStates(),
                budget_suggestions: {
                    emerging: { min: 50, max: 200 },
                    growing: { min: 100, max: 400 },
                    established: { min: 200, max: 800 },
                    large: { min: 500, max: 1500 },
                    major: { min: 1000, max: 3000 },
                    mega: { min: 2000, max: 10000 }
                }
            }
        });
    }
}

module.exports = CampaignControllerMVP;