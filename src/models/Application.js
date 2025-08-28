const fs = require('fs');
const path = require('path');

class Application {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/applications.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    async create(applicationData) {
        try {
            // Check if application already exists
            const existing = await this.findByCampaignAndInfluencer(
                applicationData.campaign_id, 
                applicationData.influencer_id
            );
            
            if (existing) {
                throw new Error('You have already applied to this campaign');
            }

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO applications (
                        campaign_id, influencer_id, message, proposed_timeline, 
                        portfolio_examples, status
                    ) VALUES ($1, $2, $3, $4, $5, $6) 
                    RETURNING *`,
                    [
                        applicationData.campaign_id,
                        applicationData.influencer_id,
                        applicationData.message,
                        applicationData.proposed_timeline,
                        applicationData.portfolio_examples || [],
                        applicationData.status || 'pending'
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = applications.length > 0 ? Math.max(...applications.map(a => a.id)) + 1 : 1;
                
                const application = {
                    id: newId,
                    ...applicationData,
                    portfolio_examples: applicationData.portfolio_examples || [],
                    status: applicationData.status || 'pending',
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

    async findById(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT a.*, 
                            i.display_name, i.tier, i.profile_image, i.bio,
                            i.instagram_followers, i.tiktok_followers, i.xhs_followers, i.youtube_followers,
                            c.title as campaign_title, c.description as campaign_description,
                            r.business_name
                     FROM applications a
                     JOIN influencers i ON a.influencer_id = i.id
                     JOIN campaigns c ON a.campaign_id = c.id
                     JOIN restaurants r ON c.restaurant_id = r.id
                     WHERE a.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const application = applications.find(a => a.id === parseInt(id));
                
                if (application) {
                    // Enrich with related data
                    const Influencer = require('./Influencer');
                    const Campaign = require('./Campaign');
                    const Restaurant = require('./Restaurant');
                    
                    const influencerModel = new Influencer();
                    const campaignModel = new Campaign();
                    
                    const [influencer, campaign] = await Promise.all([
                        influencerModel.findById(application.influencer_id),
                        campaignModel.findById(application.campaign_id, true)
                    ]);
                    
                    return {
                        ...application,
                        display_name: influencer?.display_name,
                        tier: influencer?.tier,
                        profile_image: influencer?.profile_image,
                        bio: influencer?.bio,
                        instagram_followers: influencer?.instagram_followers,
                        tiktok_followers: influencer?.tiktok_followers,
                        xhs_followers: influencer?.xhs_followers,
                        youtube_followers: influencer?.youtube_followers,
                        campaign_title: campaign?.title,
                        campaign_description: campaign?.description,
                        business_name: campaign?.business_name
                    };
                }
                
                return application;
            }
        } catch (error) {
            throw new Error(`Failed to find application: ${error.message}`);
        }
    }

    async findByCampaign(campaignId, includeInfluencer = true) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `SELECT a.*`;
                
                if (includeInfluencer) {
                    query += `, 
                        i.display_name, i.tier, i.profile_image, i.bio,
                        i.instagram_followers, i.tiktok_followers, i.xhs_followers, i.youtube_followers,
                        u.email as influencer_email`;
                }
                
                query += ` FROM applications a`;
                
                if (includeInfluencer) {
                    query += ` 
                        JOIN influencers i ON a.influencer_id = i.id
                        JOIN users u ON i.user_id = u.id`;
                }
                
                query += ` WHERE a.campaign_id = $1 ORDER BY a.applied_at DESC`;
                
                const result = await db.query(query, [campaignId]);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                let filtered = applications.filter(a => a.campaign_id === parseInt(campaignId));
                
                if (includeInfluencer) {
                    const Influencer = require('./Influencer');
                    const influencerModel = new Influencer();
                    
                    filtered = await Promise.all(
                        filtered.map(async application => {
                            const influencer = await influencerModel.findById(application.influencer_id);
                            return {
                                ...application,
                                display_name: influencer?.display_name,
                                tier: influencer?.tier,
                                profile_image: influencer?.profile_image,
                                bio: influencer?.bio,
                                instagram_followers: influencer?.instagram_followers,
                                tiktok_followers: influencer?.tiktok_followers,
                                xhs_followers: influencer?.xhs_followers,
                                youtube_followers: influencer?.youtube_followers,
                                influencer_email: influencer?.email
                            };
                        })
                    );
                }
                
                return filtered.sort((a, b) => 
                    new Date(b.applied_at) - new Date(a.applied_at)
                );
            }
        } catch (error) {
            throw new Error(`Failed to find applications by campaign: ${error.message}`);
        }
    }

    async findByInfluencer(influencerId, includeCampaign = true) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `SELECT a.*`;
                
                if (includeCampaign) {
                    query += `, 
                        c.title as campaign_title, c.description as campaign_description,
                        c.total_budget, c.deadline, c.status as campaign_status,
                        r.business_name, r.profile_image as restaurant_image`;
                }
                
                query += ` FROM applications a`;
                
                if (includeCampaign) {
                    query += ` 
                        JOIN campaigns c ON a.campaign_id = c.id
                        JOIN restaurants r ON c.restaurant_id = r.id`;
                }
                
                query += ` WHERE a.influencer_id = $1 ORDER BY a.applied_at DESC`;
                
                const result = await db.query(query, [influencerId]);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                let filtered = applications.filter(a => a.influencer_id === parseInt(influencerId));
                
                if (includeCampaign) {
                    const Campaign = require('./Campaign');
                    const campaignModel = new Campaign();
                    
                    filtered = await Promise.all(
                        filtered.map(async application => {
                            const campaign = await campaignModel.findById(application.campaign_id, true);
                            return {
                                ...application,
                                campaign_title: campaign?.title,
                                campaign_description: campaign?.description,
                                total_budget: campaign?.total_budget,
                                deadline: campaign?.deadline,
                                campaign_status: campaign?.status,
                                business_name: campaign?.business_name,
                                restaurant_image: campaign?.restaurant_image
                            };
                        })
                    );
                }
                
                return filtered.sort((a, b) => 
                    new Date(b.applied_at) - new Date(a.applied_at)
                );
            }
        } catch (error) {
            throw new Error(`Failed to find applications by influencer: ${error.message}`);
        }
    }

    async findByCampaignAndInfluencer(campaignId, influencerId) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM applications WHERE campaign_id = $1 AND influencer_id = $2',
                    [campaignId, influencerId]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return applications.find(a => 
                    a.campaign_id === parseInt(campaignId) && 
                    a.influencer_id === parseInt(influencerId)
                );
            }
        } catch (error) {
            throw new Error(`Failed to find application: ${error.message}`);
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
                    `UPDATE applications SET ${fields} WHERE id = $1 RETURNING *`,
                    values
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = applications.findIndex(a => a.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('Application not found');
                }
                
                applications[index] = {
                    ...applications[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                
                fs.writeFileSync(this.dataFile, JSON.stringify(applications, null, 2));
                return applications[index];
            }
        } catch (error) {
            throw new Error(`Failed to update application: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query('DELETE FROM applications WHERE id = $1', [id]);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const filtered = applications.filter(a => a.id !== parseInt(id));
                fs.writeFileSync(this.dataFile, JSON.stringify(filtered, null, 2));
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to delete application: ${error.message}`);
        }
    }

    // Accept application
    async accept(id, updates = {}) {
        const applicationUpdates = {
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            ...updates
        };
        
        const application = await this.update(id, applicationUpdates);
        
        // Update campaign status if needed
        if (application) {
            try {
                const Campaign = require('./Campaign');
                const campaignModel = new Campaign();
                await campaignModel.update(application.campaign_id, { 
                    status: 'in_progress' 
                });
            } catch (error) {
                console.warn('Failed to update campaign status:', error.message);
            }
        }
        
        return application;
    }

    // Reject application
    async reject(id, reason = null) {
        return this.update(id, {
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: reason
        });
    }

    // Get application statistics
    async getStats(filters = {}) {
        try {
            let applications = [];
            
            if (filters.campaign_id) {
                applications = await this.findByCampaign(filters.campaign_id, false);
            } else if (filters.influencer_id) {
                applications = await this.findByInfluencer(filters.influencer_id, false);
            } else {
                // Get all applications (would need to implement findAll method)
                applications = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
            }
            
            const stats = {
                total: applications.length,
                by_status: {
                    pending: 0,
                    accepted: 0,
                    rejected: 0
                }
            };
            
            applications.forEach(app => {
                stats.by_status[app.status]++;
            });
            
            return stats;
        } catch (error) {
            throw new Error(`Failed to get application stats: ${error.message}`);
        }
    }

    // Check if influencer can apply to campaign
    async canApply(campaignId, influencerId) {
        try {
            // Check if already applied
            const existing = await this.findByCampaignAndInfluencer(campaignId, influencerId);
            if (existing) {
                return { canApply: false, reason: 'Already applied to this campaign' };
            }
            
            // Check campaign status
            const Campaign = require('./Campaign');
            const campaignModel = new Campaign();
            const campaign = await campaignModel.findById(campaignId);
            
            if (!campaign) {
                return { canApply: false, reason: 'Campaign not found' };
            }
            
            if (campaign.status !== 'published') {
                return { canApply: false, reason: 'Campaign is not accepting applications' };
            }
            
            // Check deadline
            if (campaign.deadline && new Date(campaign.deadline) < new Date()) {
                return { canApply: false, reason: 'Campaign deadline has passed' };
            }
            
            // Check if influencer's tier matches campaign requirements
            const Influencer = require('./Influencer');
            const influencerModel = new Influencer();
            const influencer = await influencerModel.findById(influencerId);
            
            if (!influencer) {
                return { canApply: false, reason: 'Influencer not found' };
            }
            
            if (campaign.target_tiers && campaign.target_tiers.length > 0) {
                if (!campaign.target_tiers.includes(influencer.tier)) {
                    return { canApply: false, reason: 'Your tier is not eligible for this campaign' };
                }
            }
            
            return { canApply: true };
        } catch (error) {
            return { canApply: false, reason: error.message };
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
}

module.exports = Application;