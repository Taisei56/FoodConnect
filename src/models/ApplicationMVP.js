const fs = require('fs');
const path = require('path');

class ApplicationMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/applications.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    // Create application
    async create(applicationData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO applications (
                        campaign_id, influencer_id, status, message, proposed_timeline, portfolio_examples
                    ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [
                        applicationData.campaign_id,
                        applicationData.influencer_id,
                        applicationData.status || 'pending',
                        applicationData.message,
                        applicationData.proposed_timeline,
                        applicationData.portfolio_examples || []
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) + 1 : 1;

                const application = {
                    id: newId,
                    campaign_id: applicationData.campaign_id,
                    influencer_id: applicationData.influencer_id,
                    status: applicationData.status || 'pending',
                    message: applicationData.message,
                    proposed_timeline: applicationData.proposed_timeline,
                    portfolio_examples: applicationData.portfolio_examples || [],
                    applied_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                applications.push(application);
                fs.writeFileSync(this.dataFile, JSON.stringify(applications, null, 2));
                return application;
            }
        } catch (error) {
            throw new Error(`Failed to create application: ${error.message}`);
        }
    }

    // Find application by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT a.*, c.title as campaign_title, i.display_name as influencer_name,
                            r.business_name as restaurant_name
                     FROM applications a
                     JOIN campaigns c ON a.campaign_id = c.id
                     JOIN influencers i ON a.influencer_id = i.id
                     JOIN restaurants r ON c.restaurant_id = r.id
                     WHERE a.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));

                const application = applications.find(a => a.id === parseInt(id));
                if (application) {
                    const campaign = campaigns.find(c => c.id === application.campaign_id);
                    const influencer = influencers.find(i => i.id === application.influencer_id);
                    const restaurant = campaign ? restaurants.find(r => r.id === campaign.restaurant_id) : null;

                    return {
                        ...application,
                        campaign_title: campaign?.title,
                        influencer_name: influencer?.display_name,
                        restaurant_name: restaurant?.business_name
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Error finding application by ID:', error);
            return null;
        }
    }

    // Find application by campaign and influencer
    async findByCampaignAndInfluencer(campaignId, influencerId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM applications WHERE campaign_id = $1 AND influencer_id = $2',
                    [campaignId, influencerId]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return applications.find(a =>
                    a.campaign_id === parseInt(campaignId) &&
                    a.influencer_id === parseInt(influencerId)
                );
            }
        } catch (error) {
            console.error('Error finding application by campaign and influencer:', error);
            return null;
        }
    }

    // Get all applications with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT a.*, c.title as campaign_title, i.display_name as influencer_name,
                           r.business_name as restaurant_name, r.id as restaurant_id,
                           i.tier as influencer_tier, i.instagram_followers, i.tiktok_followers,
                           i.xhs_followers, i.youtube_followers, i.location as influencer_location
                    FROM applications a
                    JOIN campaigns c ON a.campaign_id = c.id
                    JOIN influencers i ON a.influencer_id = i.id
                    JOIN restaurants r ON c.restaurant_id = r.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`a.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.campaign_id) {
                    conditions.push(`a.campaign_id = $${values.length + 1}`);
                    values.push(filters.campaign_id);
                }

                if (filters.influencer_id) {
                    conditions.push(`a.influencer_id = $${values.length + 1}`);
                    values.push(filters.influencer_id);
                }

                if (filters.restaurant_id) {
                    conditions.push(`c.restaurant_id = $${values.length + 1}`);
                    values.push(filters.restaurant_id);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY a.applied_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));

                // Join with related data
                const applicationsWithDetails = applications.map(application => {
                    const campaign = campaigns.find(c => c.id === application.campaign_id);
                    const influencer = influencers.find(i => i.id === application.influencer_id);
                    const restaurant = campaign ? restaurants.find(r => r.id === campaign.restaurant_id) : null;

                    return {
                        ...application,
                        campaign_title: campaign?.title,
                        influencer_name: influencer?.display_name,
                        restaurant_name: restaurant?.business_name,
                        restaurant_id: restaurant?.id,
                        influencer_tier: influencer?.tier,
                        instagram_followers: influencer?.instagram_followers,
                        tiktok_followers: influencer?.tiktok_followers,
                        xhs_followers: influencer?.xhs_followers,
                        youtube_followers: influencer?.youtube_followers,
                        influencer_location: influencer?.location
                    };
                });

                let filtered = applicationsWithDetails;

                if (filters.status) {
                    filtered = filtered.filter(a => a.status === filters.status);
                }

                if (filters.campaign_id) {
                    filtered = filtered.filter(a => a.campaign_id === parseInt(filters.campaign_id));
                }

                if (filters.influencer_id) {
                    filtered = filtered.filter(a => a.influencer_id === parseInt(filters.influencer_id));
                }

                if (filters.restaurant_id) {
                    filtered = filtered.filter(a => a.restaurant_id === parseInt(filters.restaurant_id));
                }

                return filtered.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
            }
        } catch (error) {
            throw new Error(`Failed to find applications: ${error.message}`);
        }
    }

    // Update application status
    async updateStatus(id, status) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                    [status, id]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = applications.findIndex(a => a.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Application not found');
                }

                applications[index].status = status;
                applications[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(applications, null, 2));
                return applications[index];
            }
        } catch (error) {
            throw new Error(`Failed to update application status: ${error.message}`);
        }
    }

    // Accept application
    async accept(id) {
        return await this.updateStatus(id, 'accepted');
    }

    // Reject application
    async reject(id) {
        return await this.updateStatus(id, 'rejected');
    }

    // Get applications by campaign
    async getByCampaign(campaignId) {
        return await this.findAll({ campaign_id: campaignId });
    }

    // Get applications by influencer
    async getByInfluencer(influencerId) {
        return await this.findAll({ influencer_id: influencerId });
    }

    // Get applications by restaurant
    async getByRestaurant(restaurantId) {
        return await this.findAll({ restaurant_id: restaurantId });
    }

    // Get pending applications
    async getPending() {
        return await this.findAll({ status: 'pending' });
    }

    // Get accepted applications
    async getAccepted() {
        return await this.findAll({ status: 'accepted' });
    }

    // Get application statistics
    async getStats(filters = {}) {
        try {
            const applications = await this.findAll(filters);

            const stats = {
                total: applications.length,
                by_status: {
                    pending: 0,
                    accepted: 0,
                    rejected: 0
                },
                by_tier: {
                    emerging: 0,
                    growing: 0,
                    established: 0,
                    large: 0,
                    major: 0,
                    mega: 0
                },
                recent_applications: 0, // last 7 days
                acceptance_rate: 0
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            applications.forEach(application => {
                if (application.status) {
                    stats.by_status[application.status]++;
                }

                if (application.influencer_tier) {
                    stats.by_tier[application.influencer_tier]++;
                }

                if (new Date(application.applied_at) > weekAgo) {
                    stats.recent_applications++;
                }
            });

            const totalProcessed = stats.by_status.accepted + stats.by_status.rejected;
            stats.acceptance_rate = totalProcessed > 0 ? (stats.by_status.accepted / totalProcessed) * 100 : 0;

            return stats;
        } catch (error) {
            throw new Error(`Failed to get application stats: ${error.message}`);
        }
    }

    // Search applications
    async search(searchTerm, filters = {}) {
        try {
            const allApplications = await this.findAll(filters);

            if (!searchTerm) {
                return allApplications;
            }

            const lowerSearchTerm = searchTerm.toLowerCase();

            return allApplications.filter(application =>
                (application.campaign_title && application.campaign_title.toLowerCase().includes(lowerSearchTerm)) ||
                (application.influencer_name && application.influencer_name.toLowerCase().includes(lowerSearchTerm)) ||
                (application.restaurant_name && application.restaurant_name.toLowerCase().includes(lowerSearchTerm)) ||
                (application.message && application.message.toLowerCase().includes(lowerSearchTerm))
            );
        } catch (error) {
            throw new Error(`Failed to search applications: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'pending': 'Pending Review',
            'accepted': 'Accepted',
            'rejected': 'Rejected'
        };
    }

    // Check if influencer can apply to campaign
    async canInfluencerApply(campaignId, influencerId) {
        try {
            const existingApplication = await this.findByCampaignAndInfluencer(campaignId, influencerId);
            return !existingApplication;
        } catch (error) {
            console.error('Error checking application eligibility:', error);
            return false;
        }
    }

    // Get timeline options
    static getTimelineOptions() {
        return [
            { value: '1-3 days', label: '1-3 days' },
            { value: '3-7 days', label: '3-7 days' },
            { value: '1-2 weeks', label: '1-2 weeks' },
            { value: '2-4 weeks', label: '2-4 weeks' }
        ];
    }

    // Delete application
    async delete(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'DELETE FROM applications WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = applications.findIndex(a => a.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Application not found');
                }

                const deleted = applications.splice(index, 1)[0];
                fs.writeFileSync(this.dataFile, JSON.stringify(applications, null, 2));
                return deleted;
            }
        } catch (error) {
            throw new Error(`Failed to delete application: ${error.message}`);
        }
    }

    // Update application
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
                    `UPDATE applications SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = applications.findIndex(a => a.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Application not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        applications[index][key] = updateData[key];
                    }
                });

                applications[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(applications, null, 2));
                return applications[index];
            }
        } catch (error) {
            throw new Error(`Failed to update application: ${error.message}`);
        }
    }
}

module.exports = ApplicationMVP;