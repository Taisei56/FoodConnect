const fs = require('fs');
const path = require('path');

class Campaign {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/campaigns.json');
        this.budgetsFile = path.join(__dirname, '../../data/mvp/campaign_budgets.json');
        this.ensureDataFiles();
    }

    ensureDataFiles() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
        if (!fs.existsSync(this.budgetsFile)) {
            fs.writeFileSync(this.budgetsFile, JSON.stringify([], null, 2));
        }
    }

    async create(campaignData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                
                // Start transaction
                await db.query('BEGIN');
                
                // Create campaign
                const campaignResult = await db.query(
                    `INSERT INTO campaigns (
                        restaurant_id, title, description, brief, total_budget,
                        deadline, location, dietary_categories, target_tiers, 
                        max_influencers, status
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
                        campaignData.max_influencers,
                        campaignData.status || 'draft'
                    ]
                );
                
                const campaign = campaignResult.rows[0];
                
                // Create budget allocations if provided
                if (campaignData.budget_allocations && campaignData.budget_allocations.length > 0) {
                    for (const allocation of campaignData.budget_allocations) {
                        await db.query(
                            `INSERT INTO campaign_budgets (
                                campaign_id, tier, budget_per_influencer, max_influencers
                            ) VALUES ($1, $2, $3, $4)`,
                            [
                                campaign.id,
                                allocation.tier,
                                allocation.budget_per_influencer,
                                allocation.max_influencers
                            ]
                        );
                    }
                }
                
                await db.query('COMMIT');
                return campaign;
                
            } catch (dbError) {
                // Rollback on error
                try {
                    const db = require('../config/database');
                    await db.query('ROLLBACK');
                } catch (rollbackError) {
                    // Ignore rollback errors for JSON fallback
                }
                
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const budgets = JSON.parse(fs.readFileSync(this.budgetsFile, 'utf8'));
                
                const newId = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.id)) + 1 : 1;
                
                const campaign = {
                    id: newId,
                    ...campaignData,
                    dietary_categories: campaignData.dietary_categories || [],
                    target_tiers: campaignData.target_tiers || [],
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
                            campaign_id: newId,
                            tier: allocation.tier,
                            budget_per_influencer: allocation.budget_per_influencer,
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

    async findById(id, includeRestaurant = false) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    SELECT c.*
                    ${includeRestaurant ? ', r.business_name, r.location as restaurant_location, r.profile_image as restaurant_image' : ''}
                    FROM campaigns c
                    ${includeRestaurant ? 'JOIN restaurants r ON c.restaurant_id = r.id' : ''}
                    WHERE c.id = $1
                `;
                
                const campaignResult = await db.query(query, [id]);
                const campaign = campaignResult.rows[0];
                
                if (campaign) {
                    // Get budget allocations
                    const budgetResult = await db.query(
                        'SELECT * FROM campaign_budgets WHERE campaign_id = $1 ORDER BY tier',
                        [id]
                    );
                    campaign.budget_allocations = budgetResult.rows;
                }
                
                return campaign;
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const budgets = JSON.parse(fs.readFileSync(this.budgetsFile, 'utf8'));
                
                let campaign = campaigns.find(c => c.id === parseInt(id));
                
                if (campaign && includeRestaurant) {
                    const Restaurant = require('./Restaurant');
                    const restaurantModel = new Restaurant();
                    const restaurant = await restaurantModel.findById(campaign.restaurant_id);
                    
                    if (restaurant) {
                        campaign.business_name = restaurant.business_name;
                        campaign.restaurant_location = restaurant.location;
                        campaign.restaurant_image = restaurant.profile_image;
                    }
                }
                
                if (campaign) {
                    campaign.budget_allocations = budgets.filter(b => b.campaign_id === parseInt(id));
                }
                
                return campaign;
            }
        } catch (error) {
            throw new Error(`Failed to find campaign: ${error.message}`);
        }
    }

    async findAll(filters = {}) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    SELECT c.*, r.business_name, r.location as restaurant_location, 
                           r.profile_image as restaurant_image,
                           (SELECT COUNT(*) FROM applications WHERE campaign_id = c.id) as application_count
                    FROM campaigns c
                    JOIN restaurants r ON c.restaurant_id = r.id
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
                
                if (filters.location) {
                    conditions.push(`c.location ILIKE $${values.length + 1}`);
                    values.push(`%${filters.location}%`);
                }
                
                if (filters.target_tiers && filters.target_tiers.length > 0) {
                    conditions.push(`c.target_tiers && $${values.length + 1}`);
                    values.push(filters.target_tiers);
                }
                
                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }
                
                query += ' ORDER BY c.created_at DESC';
                
                if (filters.limit) {
                    query += ` LIMIT ${parseInt(filters.limit)}`;
                }
                
                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const Restaurant = require('./Restaurant');
                const restaurantModel = new Restaurant();
                
                let filtered = campaigns;
                
                // Apply filters
                if (filters.status) {
                    filtered = filtered.filter(c => c.status === filters.status);
                }
                
                if (filters.restaurant_id) {
                    filtered = filtered.filter(c => c.restaurant_id === parseInt(filters.restaurant_id));
                }
                
                if (filters.location) {
                    filtered = filtered.filter(c => 
                        c.location?.toLowerCase().includes(filters.location.toLowerCase())
                    );
                }
                
                if (filters.target_tiers && filters.target_tiers.length > 0) {
                    filtered = filtered.filter(c => 
                        c.target_tiers?.some(tier => filters.target_tiers.includes(tier))
                    );
                }
                
                // Add restaurant info and application count
                const enriched = await Promise.all(
                    filtered.map(async campaign => {
                        const restaurant = await restaurantModel.findById(campaign.restaurant_id);
                        
                        // Count applications (would need Application model)
                        let applicationCount = 0;
                        try {
                            const Application = require('./Application');
                            const applicationModel = new Application();
                            const applications = await applicationModel.findByCampaign(campaign.id);
                            applicationCount = applications.length;
                        } catch (error) {
                            // Ignore if Application model not available yet
                        }
                        
                        return {
                            ...campaign,
                            business_name: restaurant?.business_name,
                            restaurant_location: restaurant?.location,
                            restaurant_image: restaurant?.profile_image,
                            application_count: applicationCount
                        };
                    })
                );
                
                // Sort by creation date
                enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                // Apply limit
                if (filters.limit) {
                    return enriched.slice(0, parseInt(filters.limit));
                }
                
                return enriched;
            }
        } catch (error) {
            throw new Error(`Failed to find campaigns: ${error.message}`);
        }
    }

    async update(id, updates) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const fields = Object.keys(updates)
                    .map((key, index) => `${key} = $${index + 2}`)
                    .join(', ');
                
                const values = [id, ...Object.values(updates)];
                
                const result = await db.query(
                    `UPDATE campaigns SET ${fields} WHERE id = $1 RETURNING *`,
                    values
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = campaigns.findIndex(c => c.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('Campaign not found');
                }
                
                campaigns[index] = {
                    ...campaigns[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                
                fs.writeFileSync(this.dataFile, JSON.stringify(campaigns, null, 2));
                return campaigns[index];
            }
        } catch (error) {
            throw new Error(`Failed to update campaign: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const campaigns = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const budgets = JSON.parse(fs.readFileSync(this.budgetsFile, 'utf8'));
                
                const filteredCampaigns = campaigns.filter(c => c.id !== parseInt(id));
                const filteredBudgets = budgets.filter(b => b.campaign_id !== parseInt(id));
                
                fs.writeFileSync(this.dataFile, JSON.stringify(filteredCampaigns, null, 2));
                fs.writeFileSync(this.budgetsFile, JSON.stringify(filteredBudgets, null, 2));
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to delete campaign: ${error.message}`);
        }
    }

    // Get campaigns available for influencer applications
    async getAvailableForInfluencer(influencerId, filters = {}) {
        try {
            // Get influencer details to match with campaign requirements
            const Influencer = require('./Influencer');
            const influencerModel = new Influencer();
            const influencer = await influencerModel.findById(influencerId);
            
            if (!influencer) {
                throw new Error('Influencer not found');
            }
            
            // Base filters for available campaigns
            const baseFilters = {
                status: 'published',
                ...filters
            };
            
            // Get all published campaigns
            const campaigns = await this.findAll(baseFilters);
            
            // Filter campaigns that match influencer's tier
            const matchingCampaigns = campaigns.filter(campaign => {
                // Check if influencer's tier is in target tiers
                if (campaign.target_tiers && campaign.target_tiers.length > 0) {
                    return campaign.target_tiers.includes(influencer.tier);
                }
                return true; // If no tier restrictions, all influencers can apply
            });
            
            // TODO: Filter out campaigns where influencer already applied
            // This would require checking the applications table
            
            return matchingCampaigns;
        } catch (error) {
            throw new Error(`Failed to get available campaigns: ${error.message}`);
        }
    }

    // Get campaign statistics
    async getStats(restaurantId = null) {
        try {
            const filters = restaurantId ? { restaurant_id: restaurantId } : {};
            const campaigns = await this.findAll(filters);
            
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
                total_applications: 0
            };
            
            campaigns.forEach(campaign => {
                stats.by_status[campaign.status]++;
                stats.total_budget += parseFloat(campaign.total_budget) || 0;
                stats.total_applications += campaign.application_count || 0;
            });
            
            return stats;
        } catch (error) {
            throw new Error(`Failed to get campaign stats: ${error.message}`);
        }
    }

    // Publish campaign (change status from draft to published)
    async publish(id) {
        return this.update(id, { 
            status: 'published',
            published_at: new Date().toISOString()
        });
    }

    // Close campaign applications
    async closeApplications(id) {
        return this.update(id, { 
            status: 'applications_open',
            applications_closed_at: new Date().toISOString()
        });
    }

    // Start campaign (move to in progress)
    async start(id) {
        return this.update(id, { 
            status: 'in_progress',
            started_at: new Date().toISOString()
        });
    }

    // Complete campaign
    async complete(id) {
        return this.update(id, { 
            status: 'completed',
            completed_at: new Date().toISOString()
        });
    }

    // Mark campaign as paid
    async markPaid(id) {
        return this.update(id, { 
            status: 'paid',
            paid_at: new Date().toISOString()
        });
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
}

module.exports = Campaign;