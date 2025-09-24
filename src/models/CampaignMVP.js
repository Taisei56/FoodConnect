const fs = require('fs');
const path = require('path');

class CampaignMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/campaigns.json');
        this.budgetsFile = path.join(__dirname, '../../data/mvp/campaign_budgets.json');
        this.applicationsFile = path.join(__dirname, '../../data/mvp/applications.json');
        this.ensureDataFiles();
    }

    ensureDataFiles() {
        const files = [this.dataFile, this.budgetsFile, this.applicationsFile];
        files.forEach(file => {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify([], null, 2));
            }
        });
    }

    // Create campaign
    async create(campaignData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const client = await db.pool.connect();
                await client.query('BEGIN');

                // Insert campaign
                const campaignResult = await client.query(
                    `INSERT INTO campaigns (
                        restaurant_id, title, description, brief, total_budget, deadline,
                        location, dietary_categories, target_tiers, max_influencers, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING *`,
                    [
                        campaignData.restaurant_id,
                        campaignData.title,
                        campaignData.description,
                        campaignData.brief,
                        campaignData.total_budget,
                        campaignData.deadline,
                        campaignData.location,
                        campaignData.dietary_categories || [],
                        campaignData.target_tiers || [],
                        campaignData.max_influencers || 5,
                        campaignData.status || 'draft'
                    ]
                );

                const campaign = campaignResult.rows[0];

                // Insert budget allocations if provided
                if (campaignData.budget_allocations && campaignData.budget_allocations.length > 0) {
                    for (const allocation of campaignData.budget_allocations) {
                        await client.query(
                            `INSERT INTO campaign_budgets (campaign_id, tier, budget_per_influencer, max_influencers)
                             VALUES ($1, $2, $3, $4)`,
                            [campaign.id, allocation.tier, allocation.budget_per_influencer, allocation.max_influencers]
                        );
                    }
                }

                await client.query('COMMIT');
                client.release();
                return campaign;
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const budgets = JSON.parse(fs.readFileSync(this.budgetsFile, 'utf8'));
                const newId = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.id)) + 1 : 1;

                const campaign = {
                    id: newId,
                    restaurant_id: campaignData.restaurant_id,
                    title: campaignData.title,
                    description: campaignData.description,
                    brief: campaignData.brief,
                    total_budget: parseFloat(campaignData.total_budget),
                    deadline: campaignData.deadline,
                    location: campaignData.location,
                    dietary_categories: campaignData.dietary_categories || [],
                    target_tiers: campaignData.target_tiers || [],
                    max_influencers: campaignData.max_influencers || 5,
                    status: campaignData.status || 'draft',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                campaigns.push(campaign);
                fs.writeFileSync(this.dataFile, JSON.stringify(campaigns, null, 2));

                // Save budget allocations
                if (campaignData.budget_allocations && campaignData.budget_allocations.length > 0) {
                    campaignData.budget_allocations.forEach(allocation => {
                        const budgetId = budgets.length > 0 ? Math.max(...budgets.map(b => b.id)) + 1 : 1;
                        budgets.push({
                            id: budgetId,
                            campaign_id: campaign.id,
                            tier: allocation.tier,
                            budget_per_influencer: parseFloat(allocation.budget_per_influencer),
                            max_influencers: allocation.max_influencers,
                            allocated_count: 0
                        });
                    });
                    fs.writeFileSync(this.budgetsFile, JSON.stringify(budgets, null, 2));
                }

                return campaign;
            }
        } catch (error) {
            throw new Error(`Failed to create campaign: ${error.message}`);
        }
    }

    // Find campaign by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT c.*, r.business_name, r.city as restaurant_city, r.state as restaurant_state,
                            u.email as restaurant_email
                     FROM campaigns c
                     JOIN restaurants r ON c.restaurant_id = r.id
                     JOIN users u ON r.user_id = u.id
                     WHERE c.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                const campaign = campaigns.find(c => c.id === parseInt(id));
                if (campaign) {
                    const restaurant = restaurants.find(r => r.id === campaign.restaurant_id);
                    const user = restaurant ? users.find(u => u.id === restaurant.user_id) : null;
                    return {
                        ...campaign,
                        business_name: restaurant?.business_name,
                        restaurant_city: restaurant?.city,
                        restaurant_state: restaurant?.state,
                        restaurant_email: user?.email
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Error finding campaign by ID:', error);
            return null;
        }
    }

    // Get all campaigns with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT c.*, r.business_name, r.city as restaurant_city, r.state as restaurant_state,
                           u.email as restaurant_email, u.status as restaurant_status
                    FROM campaigns c
                    JOIN restaurants r ON c.restaurant_id = r.id
                    JOIN users u ON r.user_id = u.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`c.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.restaurant_id) {
                    conditions.push(`c.restaurant_id = $${values.length + 1}`);
                    values.push(filters.restaurant_id);
                }

                if (filters.city) {
                    conditions.push(`r.city ILIKE $${values.length + 1}`);
                    values.push(`%${filters.city}%`);
                }

                if (filters.state) {
                    conditions.push(`r.state = $${values.length + 1}`);
                    values.push(filters.state);
                }

                if (filters.dietary_category) {
                    conditions.push(`$${values.length + 1} = ANY(c.dietary_categories)`);
                    values.push(filters.dietary_category);
                }

                if (filters.target_tier) {
                    conditions.push(`$${values.length + 1} = ANY(c.target_tiers)`);
                    values.push(filters.target_tier);
                }

                if (filters.min_budget) {
                    conditions.push(`c.total_budget >= $${values.length + 1}`);
                    values.push(filters.min_budget);
                }

                if (filters.max_budget) {
                    conditions.push(`c.total_budget <= $${values.length + 1}`);
                    values.push(filters.max_budget);
                }

                if (filters.deadline_after) {
                    conditions.push(`c.deadline >= $${values.length + 1}`);
                    values.push(filters.deadline_after);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY c.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with restaurants and users data
                const campaignsWithDetails = campaigns.map(campaign => {
                    const restaurant = restaurants.find(r => r.id === campaign.restaurant_id);
                    const user = restaurant ? users.find(u => u.id === restaurant.user_id) : null;
                    return {
                        ...campaign,
                        business_name: restaurant?.business_name,
                        restaurant_city: restaurant?.city,
                        restaurant_state: restaurant?.state,
                        restaurant_email: user?.email,
                        restaurant_status: user?.status
                    };
                });

                let filtered = campaignsWithDetails;

                if (filters.status) {
                    filtered = filtered.filter(c => c.status === filters.status);
                }

                if (filters.restaurant_id) {
                    filtered = filtered.filter(c => c.restaurant_id === parseInt(filters.restaurant_id));
                }

                if (filters.city) {
                    filtered = filtered.filter(c => c.restaurant_city && c.restaurant_city.toLowerCase().includes(filters.city.toLowerCase()));
                }

                if (filters.state) {
                    filtered = filtered.filter(c => c.restaurant_state === filters.state);
                }

                if (filters.dietary_category) {
                    filtered = filtered.filter(c => c.dietary_categories && c.dietary_categories.includes(filters.dietary_category));
                }

                if (filters.target_tier) {
                    filtered = filtered.filter(c => c.target_tiers && c.target_tiers.includes(filters.target_tier));
                }

                if (filters.min_budget) {
                    filtered = filtered.filter(c => c.total_budget >= parseFloat(filters.min_budget));
                }

                if (filters.max_budget) {
                    filtered = filtered.filter(c => c.total_budget <= parseFloat(filters.max_budget));
                }

                if (filters.deadline_after) {
                    filtered = filtered.filter(c => new Date(c.deadline) >= new Date(filters.deadline_after));
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find campaigns: ${error.message}`);
        }
    }

    // Update campaign
    async update(id, updateData) {
        try {
            try {
                const db = require('../config/database');
                const setClause = [];
                const values = [];

                Object.keys(updateData).forEach((key, index) => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        setClause.push(`${key} = $${index + 1}`);
                        values.push(updateData[key]);
                    }
                });

                values.push(id);

                const result = await db.query(
                    `UPDATE campaigns SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = campaigns.findIndex(c => c.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Campaign not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        campaigns[index][key] = updateData[key];
                    }
                });

                campaigns[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(campaigns, null, 2));
                return campaigns[index];
            }
        } catch (error) {
            throw new Error(`Failed to update campaign: ${error.message}`);
        }
    }

    // Get campaign budget allocations
    async getBudgetAllocations(campaignId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM campaign_budgets WHERE campaign_id = $1 ORDER BY tier',
                    [campaignId]
                );
                return result.rows;
            } catch (dbError) {
                const budgets = JSON.parse(fs.readFileSync(this.budgetsFile, 'utf8'));
                return budgets.filter(b => b.campaign_id === parseInt(campaignId));
            }
        } catch (error) {
            console.error('Error getting budget allocations:', error);
            return [];
        }
    }

    // Create application to campaign
    async createApplication(applicationData) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO applications (
                        campaign_id, influencer_id, message, proposed_timeline, portfolio_examples
                    ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [
                        applicationData.campaign_id,
                        applicationData.influencer_id,
                        applicationData.message,
                        applicationData.proposed_timeline,
                        applicationData.portfolio_examples || []
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.applicationsFile, 'utf8'));
                const newId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) + 1 : 1;

                const application = {
                    id: newId,
                    campaign_id: applicationData.campaign_id,
                    influencer_id: applicationData.influencer_id,
                    status: 'pending',
                    message: applicationData.message,
                    proposed_timeline: applicationData.proposed_timeline,
                    portfolio_examples: applicationData.portfolio_examples || [],
                    applied_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                applications.push(application);
                fs.writeFileSync(this.applicationsFile, JSON.stringify(applications, null, 2));
                return application;
            }
        } catch (error) {
            throw new Error(`Failed to create application: ${error.message}`);
        }
    }

    // Get applications for a campaign
    async getApplications(campaignId, filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT a.*, i.display_name, i.tier, i.instagram_followers, i.tiktok_followers,
                           i.xhs_followers, i.youtube_followers, i.bio, i.location,
                           u.email as influencer_email
                    FROM applications a
                    JOIN influencers i ON a.influencer_id = i.id
                    JOIN users u ON i.user_id = u.id
                    WHERE a.campaign_id = $1
                `;
                const values = [campaignId];

                if (filters.status) {
                    query += ` AND a.status = $${values.length + 1}`;
                    values.push(filters.status);
                }

                query += ' ORDER BY a.applied_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.applicationsFile, 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Filter applications for this campaign
                let campaignApplications = applications.filter(a => a.campaign_id === parseInt(campaignId));

                if (filters.status) {
                    campaignApplications = campaignApplications.filter(a => a.status === filters.status);
                }

                // Join with influencers and users data
                const applicationsWithDetails = campaignApplications.map(application => {
                    const influencer = influencers.find(i => i.id === application.influencer_id);
                    const user = influencer ? users.find(u => u.id === influencer.user_id) : null;
                    return {
                        ...application,
                        display_name: influencer?.display_name,
                        tier: influencer?.tier,
                        instagram_followers: influencer?.instagram_followers,
                        tiktok_followers: influencer?.tiktok_followers,
                        xhs_followers: influencer?.xhs_followers,
                        youtube_followers: influencer?.youtube_followers,
                        bio: influencer?.bio,
                        location: influencer?.location,
                        influencer_email: user?.email
                    };
                });

                return applicationsWithDetails.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
            }
        } catch (error) {
            throw new Error(`Failed to get applications: ${error.message}`);
        }
    }

    // Update application status
    async updateApplicationStatus(applicationId, status) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                    [status, applicationId]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.applicationsFile, 'utf8'));
                const index = applications.findIndex(a => a.id === parseInt(applicationId));

                if (index === -1) {
                    throw new Error('Application not found');
                }

                applications[index].status = status;
                applications[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.applicationsFile, JSON.stringify(applications, null, 2));
                return applications[index];
            }
        } catch (error) {
            throw new Error(`Failed to update application status: ${error.message}`);
        }
    }

    // Search campaigns
    async search(searchTerm, filters = {}) {
        try {
            const allCampaigns = await this.findAll(filters);

            if (!searchTerm) {
                return allCampaigns;
            }

            const lowerSearchTerm = searchTerm.toLowerCase();

            return allCampaigns.filter(campaign =>
                (campaign.title && campaign.title.toLowerCase().includes(lowerSearchTerm)) ||
                (campaign.description && campaign.description.toLowerCase().includes(lowerSearchTerm)) ||
                (campaign.business_name && campaign.business_name.toLowerCase().includes(lowerSearchTerm)) ||
                (campaign.location && campaign.location.toLowerCase().includes(lowerSearchTerm))
            );
        } catch (error) {
            throw new Error(`Failed to search campaigns: ${error.message}`);
        }
    }

    // Get campaign statistics
    async getStats() {
        try {
            const campaigns = await this.findAll();

            const stats = {
                total: campaigns.length,
                by_status: {
                    draft: 0,
                    published: 0,
                    applications_open: 0,
                    in_progress: 0,
                    completed: 0,
                    paid: 0
                },
                total_budget: 0,
                average_budget: 0,
                recent_campaigns: 0 // last 7 days
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            campaigns.forEach(campaign => {
                if (campaign.status) {
                    stats.by_status[campaign.status]++;
                }

                stats.total_budget += parseFloat(campaign.total_budget) || 0;

                if (new Date(campaign.created_at) > weekAgo) {
                    stats.recent_campaigns++;
                }
            });

            stats.average_budget = campaigns.length > 0 ? stats.total_budget / campaigns.length : 0;

            return stats;
        } catch (error) {
            throw new Error(`Failed to get campaign stats: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'draft': 'Draft',
            'published': 'Published',
            'applications_open': 'Applications Open',
            'in_progress': 'In Progress',
            'completed': 'Completed',
            'paid': 'Paid'
        };
    }

    // Get dietary categories
    static getDietaryCategories() {
        return {
            'halal_certified': 'Halal Certified',
            'halal_friendly': 'Halal-Friendly',
            'non_halal': 'Non-Halal',
            'vegetarian': 'Vegetarian Options',
            'vegan': 'Vegan Options',
            'no_beef': 'No Beef',
            'no_pork': 'No Pork'
        };
    }

    // Get influencer tiers
    static getInfluencerTiers() {
        return {
            'emerging': 'Emerging Influencers (1K-5K)',
            'growing': 'Growing Influencers (5K-10K)',
            'established': 'Established Influencers (10K-20K)',
            'large': 'Large Influencers (20K-50K)',
            'major': 'Major Influencers (50K-100K)',
            'mega': 'Mega Creators (100K+)'
        };
    }

    // Check if user can apply to campaign
    async canUserApply(campaignId, influencerId) {
        try {
            const existingApplication = await this.getApplications(campaignId, { influencer_id: influencerId });
            return existingApplication.length === 0;
        } catch (error) {
            console.error('Error checking application eligibility:', error);
            return false;
        }
    }

    // Get campaigns by restaurant
    async getByRestaurant(restaurantId) {
        return await this.findAll({ restaurant_id: restaurantId });
    }

    // Get published campaigns for influencers
    async getPublishedCampaigns(filters = {}) {
        const publishedFilters = { ...filters, status: 'published' };
        return await this.findAll(publishedFilters);
    }
}

module.exports = CampaignMVP;