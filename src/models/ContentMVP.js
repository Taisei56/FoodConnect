const fs = require('fs');
const path = require('path');

class ContentMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/content_submissions.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    // Submit content for approval
    async submitContent(contentData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO content_submissions (
                        application_id, video_url, description, platforms, status
                    ) VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
                    [
                        contentData.application_id,
                        contentData.video_url,
                        contentData.description || '',
                        contentData.platforms || []
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1;

                const submission = {
                    id: newId,
                    application_id: contentData.application_id,
                    video_url: contentData.video_url,
                    description: contentData.description || '',
                    platforms: contentData.platforms || [],
                    status: 'pending',
                    restaurant_feedback: null,
                    submitted_at: new Date().toISOString(),
                    reviewed_at: null,
                    approved_at: null,
                    posted_at: null
                };

                submissions.push(submission);
                fs.writeFileSync(this.dataFile, JSON.stringify(submissions, null, 2));
                return submission;
            }
        } catch (error) {
            throw new Error(`Failed to submit content: ${error.message}`);
        }
    }

    // Find content by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT cs.*, a.campaign_id, a.influencer_id,
                            c.title as campaign_title, i.display_name as influencer_name,
                            r.business_name as restaurant_name
                     FROM content_submissions cs
                     JOIN applications a ON cs.application_id = a.id
                     JOIN campaigns c ON a.campaign_id = c.id
                     JOIN influencers i ON a.influencer_id = i.id
                     JOIN restaurants r ON c.restaurant_id = r.id
                     WHERE cs.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const applications = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/applications.json'), 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));

                const submission = submissions.find(s => s.id === parseInt(id));
                if (submission) {
                    const application = applications.find(a => a.id === submission.application_id);
                    const campaign = application ? campaigns.find(c => c.id === application.campaign_id) : null;
                    const influencer = application ? influencers.find(i => i.id === application.influencer_id) : null;
                    const restaurant = campaign ? restaurants.find(r => r.id === campaign.restaurant_id) : null;

                    return {
                        ...submission,
                        campaign_id: application?.campaign_id,
                        influencer_id: application?.influencer_id,
                        campaign_title: campaign?.title,
                        influencer_name: influencer?.display_name,
                        restaurant_name: restaurant?.business_name
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Error finding content by ID:', error);
            return null;
        }
    }

    // Get content submissions with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT cs.*, a.campaign_id, a.influencer_id,
                           c.title as campaign_title, i.display_name as influencer_name,
                           r.business_name as restaurant_name, r.id as restaurant_id
                    FROM content_submissions cs
                    JOIN applications a ON cs.application_id = a.id
                    JOIN campaigns c ON a.campaign_id = c.id
                    JOIN influencers i ON a.influencer_id = i.id
                    JOIN restaurants r ON c.restaurant_id = r.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`cs.status = $${values.length + 1}`);
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

                query += ' ORDER BY cs.submitted_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const applications = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/applications.json'), 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/influencers.json'), 'utf8'));
                const restaurants = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/restaurants.json'), 'utf8'));

                // Join with related data
                const submissionsWithDetails = submissions.map(submission => {
                    const application = applications.find(a => a.id === submission.application_id);
                    const campaign = application ? campaigns.find(c => c.id === application.campaign_id) : null;
                    const influencer = application ? influencers.find(i => i.id === application.influencer_id) : null;
                    const restaurant = campaign ? restaurants.find(r => r.id === campaign.restaurant_id) : null;

                    return {
                        ...submission,
                        campaign_id: application?.campaign_id,
                        influencer_id: application?.influencer_id,
                        campaign_title: campaign?.title,
                        influencer_name: influencer?.display_name,
                        restaurant_name: restaurant?.business_name,
                        restaurant_id: restaurant?.id
                    };
                });

                let filtered = submissionsWithDetails;

                if (filters.status) {
                    filtered = filtered.filter(s => s.status === filters.status);
                }

                if (filters.campaign_id) {
                    filtered = filtered.filter(s => s.campaign_id === parseInt(filters.campaign_id));
                }

                if (filters.influencer_id) {
                    filtered = filtered.filter(s => s.influencer_id === parseInt(filters.influencer_id));
                }

                if (filters.restaurant_id) {
                    filtered = filtered.filter(s => s.restaurant_id === parseInt(filters.restaurant_id));
                }

                return filtered.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            }
        } catch (error) {
            throw new Error(`Failed to find content submissions: ${error.message}`);
        }
    }

    // Update content submission status
    async updateStatus(id, status, feedback = null) {
        try {
            try {
                const db = require('../config/database');
                const updateData = { status };
                const setClause = ['status = $1'];
                const values = [status];

                if (feedback) {
                    setClause.push(`restaurant_feedback = $${values.length + 1}`);
                    values.push(feedback);
                }

                if (status === 'approved') {
                    setClause.push('approved_at = CURRENT_TIMESTAMP');
                }

                if (status === 'rejected' || status === 'approved') {
                    setClause.push('reviewed_at = CURRENT_TIMESTAMP');
                }

                values.push(id);

                const result = await db.query(
                    `UPDATE content_submissions SET ${setClause.join(', ')}
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = submissions.findIndex(s => s.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Content submission not found');
                }

                submissions[index].status = status;
                if (feedback) submissions[index].restaurant_feedback = feedback;

                const now = new Date().toISOString();
                if (status === 'approved') {
                    submissions[index].approved_at = now;
                }
                if (status === 'rejected' || status === 'approved') {
                    submissions[index].reviewed_at = now;
                }

                fs.writeFileSync(this.dataFile, JSON.stringify(submissions, null, 2));
                return submissions[index];
            }
        } catch (error) {
            throw new Error(`Failed to update content status: ${error.message}`);
        }
    }

    // Mark content as posted
    async markAsPosted(id, platforms = []) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `UPDATE content_submissions
                     SET status = 'posted', platforms = $1, posted_at = CURRENT_TIMESTAMP
                     WHERE id = $2 RETURNING *`,
                    [platforms, id]
                );
                return result.rows[0];
            } catch (dbError) {
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = submissions.findIndex(s => s.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Content submission not found');
                }

                submissions[index].status = 'posted';
                submissions[index].platforms = platforms;
                submissions[index].posted_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(submissions, null, 2));
                return submissions[index];
            }
        } catch (error) {
            throw new Error(`Failed to mark content as posted: ${error.message}`);
        }
    }

    // Get content by application
    async getByApplication(applicationId) {
        return await this.findAll({ application_id: applicationId });
    }

    // Get content by campaign
    async getByCampaign(campaignId) {
        return await this.findAll({ campaign_id: campaignId });
    }

    // Get content by influencer
    async getByInfluencer(influencerId) {
        return await this.findAll({ influencer_id: influencerId });
    }

    // Get content by restaurant
    async getByRestaurant(restaurantId) {
        return await this.findAll({ restaurant_id: restaurantId });
    }

    // Get pending content for review
    async getPendingContent() {
        return await this.findAll({ status: 'pending' });
    }

    // Get content statistics
    async getStats(filters = {}) {
        try {
            const content = await this.findAll(filters);

            const stats = {
                total_submissions: content.length,
                by_status: {
                    pending: 0,
                    submitted: 0,
                    approved: 0,
                    rejected: 0,
                    posted: 0
                },
                recent_submissions: 0, // last 7 days
                approval_rate: 0
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            content.forEach(submission => {
                if (submission.status) {
                    stats.by_status[submission.status]++;
                }

                if (new Date(submission.submitted_at) > weekAgo) {
                    stats.recent_submissions++;
                }
            });

            const totalReviewed = stats.by_status.approved + stats.by_status.rejected;
            stats.approval_rate = totalReviewed > 0 ? (stats.by_status.approved / totalReviewed) * 100 : 0;

            return stats;
        } catch (error) {
            throw new Error(`Failed to get content stats: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'pending': 'Pending Review',
            'submitted': 'Submitted for Review',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'posted': 'Posted on Platforms'
        };
    }

    // Get supported platforms
    static getSupportedPlatforms() {
        return [
            { id: 'instagram', name: 'Instagram', description: 'Instagram Reels/Posts' },
            { id: 'tiktok', name: 'TikTok', description: 'TikTok Videos' },
            { id: 'xhs', name: 'XHS (Xiaohongshu)', description: 'Little Red Book' },
            { id: 'youtube', name: 'YouTube', description: 'YouTube Videos/Shorts' },
            { id: 'facebook', name: 'Facebook', description: 'Facebook Posts/Videos' }
        ];
    }

    // Validate video URL
    static validateVideoUrl(url) {
        const videoPatterns = [
            /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
            /^https?:\/\/(www\.)?tiktok\.com\/.+/,
            /^https?:\/\/(www\.)?instagram\.com\/.+/,
            /^https?:\/\/(www\.)?facebook\.com\/.+/,
            /\.(mp4|mov|avi|wmv|flv|webm)$/i
        ];

        return videoPatterns.some(pattern => pattern.test(url));
    }

    // Get content workflow
    static getContentWorkflow() {
        return [
            {
                step: 1,
                status: 'pending',
                title: 'Content Creation',
                description: 'Influencer creates video content',
                actor: 'Influencer'
            },
            {
                step: 2,
                status: 'submitted',
                title: 'Submit for Review',
                description: 'Influencer submits content with video link',
                actor: 'Influencer'
            },
            {
                step: 3,
                status: 'approved',
                title: 'Content Approval',
                description: 'Restaurant reviews and approves content',
                actor: 'Restaurant'
            },
            {
                step: 4,
                status: 'posted',
                title: 'Post on Platforms',
                description: 'Influencer posts on all agreed platforms',
                actor: 'Influencer'
            }
        ];
    }

    // Update submission details
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
                    `UPDATE content_submissions SET ${setClause.join(', ')}
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = submissions.findIndex(s => s.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Content submission not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        submissions[index][key] = updateData[key];
                    }
                });

                fs.writeFileSync(this.dataFile, JSON.stringify(submissions, null, 2));
                return submissions[index];
            }
        } catch (error) {
            throw new Error(`Failed to update content submission: ${error.message}`);
        }
    }

    // Delete content submission
    async delete(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'DELETE FROM content_submissions WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const submissions = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = submissions.findIndex(s => s.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Content submission not found');
                }

                const deleted = submissions.splice(index, 1)[0];
                fs.writeFileSync(this.dataFile, JSON.stringify(submissions, null, 2));
                return deleted;
            }
        } catch (error) {
            throw new Error(`Failed to delete content submission: ${error.message}`);
        }
    }
}

module.exports = ContentMVP;