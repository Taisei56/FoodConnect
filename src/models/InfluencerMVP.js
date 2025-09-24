const fs = require('fs');
const path = require('path');

class InfluencerMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/influencers.json');
        this.followerUpdatesFile = path.join(__dirname, '../../data/mvp/follower_updates.json');
        this.ensureDataFiles();
    }

    ensureDataFiles() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
        if (!fs.existsSync(this.followerUpdatesFile)) {
            fs.writeFileSync(this.followerUpdatesFile, JSON.stringify([], null, 2));
        }
    }

    // Calculate influencer tier based on highest follower count
    static calculateTier(instagramFollowers = 0, tiktokFollowers = 0, xhsFollowers = 0, youtubeFollowers = 0) {
        const maxFollowers = Math.max(instagramFollowers, tiktokFollowers, xhsFollowers, youtubeFollowers);

        if (maxFollowers >= 100000) return 'mega';
        if (maxFollowers >= 50000) return 'major';
        if (maxFollowers >= 20000) return 'large';
        if (maxFollowers >= 10000) return 'established';
        if (maxFollowers >= 5000) return 'growing';
        return 'emerging';
    }

    // Get tier labels and descriptions
    static getTierLabels() {
        return {
            'emerging': 'Emerging Influencers (1K-5K)',
            'growing': 'Growing Influencers (5K-10K)',
            'established': 'Established Influencers (10K-20K)',
            'large': 'Large Influencers (20K-50K)',
            'major': 'Major Influencers (50K-100K)',
            'mega': 'Mega Creators (100K+)'
        };
    }

    static getTierDescriptions() {
        return {
            'emerging': 'Authentic engagement, long-term customer relationships, cost-effective',
            'growing': 'Building momentum, great engagement rates, good value for money',
            'established': 'Proven track record, reliable content creation, solid reach',
            'large': 'Significant influence, professional content, broad audience reach',
            'major': 'High impact, premium content quality, extensive reach',
            'mega': 'Large reach, immediate visibility boost, premium pricing'
        };
    }

    // Create influencer profile
    async create(influencerData) {
        try {
            // Calculate tier automatically
            const tier = InfluencerMVP.calculateTier(
                influencerData.instagram_followers || 0,
                influencerData.tiktok_followers || 0,
                influencerData.xhs_followers || 0,
                influencerData.youtube_followers || 0
            );

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO influencers (
                        user_id, display_name, phone, bio, location, city, state,
                        instagram_username, instagram_link, instagram_followers,
                        tiktok_username, tiktok_link, tiktok_followers,
                        xhs_username, xhs_link, xhs_followers,
                        youtube_channel, youtube_followers, tier
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    RETURNING *`,
                    [
                        influencerData.user_id,
                        influencerData.display_name,
                        influencerData.phone,
                        influencerData.bio,
                        influencerData.location,
                        influencerData.city,
                        influencerData.state,
                        influencerData.instagram_username,
                        influencerData.instagram_link,
                        influencerData.instagram_followers || 0,
                        influencerData.tiktok_username,
                        influencerData.tiktok_link,
                        influencerData.tiktok_followers || 0,
                        influencerData.xhs_username,
                        influencerData.xhs_link,
                        influencerData.xhs_followers || 0,
                        influencerData.youtube_channel,
                        influencerData.youtube_followers || 0,
                        tier
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = influencers.length > 0 ? Math.max(...influencers.map(i => i.id)) + 1 : 1;

                const influencer = {
                    id: newId,
                    user_id: influencerData.user_id,
                    display_name: influencerData.display_name,
                    phone: influencerData.phone,
                    bio: influencerData.bio,
                    location: influencerData.location,
                    city: influencerData.city,
                    state: influencerData.state,
                    instagram_username: influencerData.instagram_username,
                    instagram_link: influencerData.instagram_link,
                    instagram_followers: influencerData.instagram_followers || 0,
                    tiktok_username: influencerData.tiktok_username,
                    tiktok_link: influencerData.tiktok_link,
                    tiktok_followers: influencerData.tiktok_followers || 0,
                    xhs_username: influencerData.xhs_username,
                    xhs_link: influencerData.xhs_link,
                    xhs_followers: influencerData.xhs_followers || 0,
                    youtube_channel: influencerData.youtube_channel,
                    youtube_followers: influencerData.youtube_followers || 0,
                    tier: tier,
                    profile_image: null,
                    portfolio_images: [],
                    admin_notes: null,
                    approved_by: null,
                    approved_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                influencers.push(influencer);
                fs.writeFileSync(this.dataFile, JSON.stringify(influencers, null, 2));
                return influencer;
            }
        } catch (error) {
            throw new Error(`Failed to create influencer: ${error.message}`);
        }
    }

    // Find influencer by user ID
    async findByUserId(userId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM influencers WHERE user_id = $1',
                    [userId]
                );
                return result.rows[0];
            } catch (dbError) {
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return influencers.find(i => i.user_id === parseInt(userId));
            }
        } catch (error) {
            console.error('Error finding influencer by user ID:', error);
            return null;
        }
    }

    // Find influencer by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM influencers WHERE id = $1',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return influencers.find(i => i.id === parseInt(id));
            }
        } catch (error) {
            console.error('Error finding influencer by ID:', error);
            return null;
        }
    }

    // Get all influencers with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT i.*, u.email, u.status as user_status
                    FROM influencers i
                    JOIN users u ON i.user_id = u.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`u.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.tier) {
                    conditions.push(`i.tier = $${values.length + 1}`);
                    values.push(filters.tier);
                }

                if (filters.city) {
                    conditions.push(`i.city ILIKE $${values.length + 1}`);
                    values.push(`%${filters.city}%`);
                }

                if (filters.state) {
                    conditions.push(`i.state = $${values.length + 1}`);
                    values.push(filters.state);
                }

                if (filters.min_followers) {
                    conditions.push(`(
                        i.instagram_followers >= $${values.length + 1} OR
                        i.tiktok_followers >= $${values.length + 1} OR
                        i.xhs_followers >= $${values.length + 1} OR
                        i.youtube_followers >= $${values.length + 1}
                    )`);
                    values.push(filters.min_followers);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY i.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with users data
                const influencersWithUsers = influencers.map(influencer => {
                    const user = users.find(u => u.id === influencer.user_id);
                    return {
                        ...influencer,
                        email: user?.email,
                        user_status: user?.status
                    };
                });

                let filtered = influencersWithUsers;

                if (filters.status) {
                    filtered = filtered.filter(i => i.user_status === filters.status);
                }

                if (filters.tier) {
                    filtered = filtered.filter(i => i.tier === filters.tier);
                }

                if (filters.city) {
                    filtered = filtered.filter(i => i.city && i.city.toLowerCase().includes(filters.city.toLowerCase()));
                }

                if (filters.state) {
                    filtered = filtered.filter(i => i.state === filters.state);
                }

                if (filters.min_followers) {
                    filtered = filtered.filter(i =>
                        i.instagram_followers >= filters.min_followers ||
                        i.tiktok_followers >= filters.min_followers ||
                        i.xhs_followers >= filters.min_followers ||
                        i.youtube_followers >= filters.min_followers
                    );
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find influencers: ${error.message}`);
        }
    }

    // Update influencer profile
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
                    `UPDATE influencers SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = influencers.findIndex(i => i.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Influencer not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        influencers[index][key] = updateData[key];
                    }
                });

                // Recalculate tier if follower counts changed
                if (['instagram_followers', 'tiktok_followers', 'xhs_followers', 'youtube_followers'].some(field => updateData[field] !== undefined)) {
                    influencers[index].tier = InfluencerMVP.calculateTier(
                        influencers[index].instagram_followers,
                        influencers[index].tiktok_followers,
                        influencers[index].xhs_followers,
                        influencers[index].youtube_followers
                    );
                }

                influencers[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(influencers, null, 2));
                return influencers[index];
            }
        } catch (error) {
            throw new Error(`Failed to update influencer: ${error.message}`);
        }
    }

    // Create follower count update request
    async requestFollowerUpdate(influencerId, platform, currentCount, requestedCount, evidenceUrl = null) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO follower_updates (influencer_id, platform, current_count, requested_count, evidence_url, status)
                     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
                    [influencerId, platform, currentCount, requestedCount, evidenceUrl]
                );
                return result.rows[0];
            } catch (dbError) {
                const updates = JSON.parse(fs.readFileSync(this.followerUpdatesFile, 'utf8'));
                const newId = updates.length > 0 ? Math.max(...updates.map(u => u.id)) + 1 : 1;

                const update = {
                    id: newId,
                    influencer_id: influencerId,
                    platform: platform,
                    current_count: currentCount,
                    requested_count: requestedCount,
                    evidence_url: evidenceUrl,
                    status: 'pending',
                    admin_notes: null,
                    processed_by: null,
                    processed_at: null,
                    created_at: new Date().toISOString()
                };

                updates.push(update);
                fs.writeFileSync(this.followerUpdatesFile, JSON.stringify(updates, null, 2));
                return update;
            }
        } catch (error) {
            throw new Error(`Failed to create follower update request: ${error.message}`);
        }
    }

    // Get follower update requests
    async getFollowerUpdateRequests(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT fu.*, i.display_name, i.user_id, u.email
                    FROM follower_updates fu
                    JOIN influencers i ON fu.influencer_id = i.id
                    JOIN users u ON i.user_id = u.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`fu.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.influencer_id) {
                    conditions.push(`fu.influencer_id = $${values.length + 1}`);
                    values.push(filters.influencer_id);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY fu.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                const updates = JSON.parse(fs.readFileSync(this.followerUpdatesFile, 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with influencers and users data
                const updatesWithDetails = updates.map(update => {
                    const influencer = influencers.find(i => i.id === update.influencer_id);
                    const user = influencer ? users.find(u => u.id === influencer.user_id) : null;
                    return {
                        ...update,
                        display_name: influencer?.display_name,
                        user_id: influencer?.user_id,
                        email: user?.email
                    };
                });

                let filtered = updatesWithDetails;

                if (filters.status) {
                    filtered = filtered.filter(u => u.status === filters.status);
                }

                if (filters.influencer_id) {
                    filtered = filtered.filter(u => u.influencer_id === parseInt(filters.influencer_id));
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to get follower update requests: ${error.message}`);
        }
    }

    // Process follower update request
    async processFollowerUpdate(updateId, status, adminNotes = null, adminId = null) {
        try {
            try {
                const db = require('../config/database');
                const client = await db.pool.connect();
                await client.query('BEGIN');

                // Update the follower update request
                const updateResult = await client.query(
                    `UPDATE follower_updates
                     SET status = $1, admin_notes = $2, processed_by = $3, processed_at = CURRENT_TIMESTAMP
                     WHERE id = $4 RETURNING *`,
                    [status, adminNotes, adminId, updateId]
                );

                const update = updateResult.rows[0];

                // If approved, update the influencer's follower count
                if (status === 'approved') {
                    const followerField = `${update.platform}_followers`;
                    await client.query(
                        `UPDATE influencers SET ${followerField} = $1 WHERE id = $2`,
                        [update.requested_count, update.influencer_id]
                    );
                }

                await client.query('COMMIT');
                client.release();
                return update;
            } catch (dbError) {
                // Fallback to JSON storage
                const updates = JSON.parse(fs.readFileSync(this.followerUpdatesFile, 'utf8'));
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));

                const updateIndex = updates.findIndex(u => u.id === parseInt(updateId));
                if (updateIndex === -1) {
                    throw new Error('Follower update request not found');
                }

                updates[updateIndex].status = status;
                updates[updateIndex].admin_notes = adminNotes;
                updates[updateIndex].processed_by = adminId;
                updates[updateIndex].processed_at = new Date().toISOString();

                // If approved, update the influencer's follower count
                if (status === 'approved') {
                    const influencerIndex = influencers.findIndex(i => i.id === updates[updateIndex].influencer_id);
                    if (influencerIndex !== -1) {
                        const followerField = `${updates[updateIndex].platform}_followers`;
                        influencers[influencerIndex][followerField] = updates[updateIndex].requested_count;

                        // Recalculate tier
                        influencers[influencerIndex].tier = InfluencerMVP.calculateTier(
                            influencers[influencerIndex].instagram_followers,
                            influencers[influencerIndex].tiktok_followers,
                            influencers[influencerIndex].xhs_followers,
                            influencers[influencerIndex].youtube_followers
                        );

                        influencers[influencerIndex].updated_at = new Date().toISOString();
                        fs.writeFileSync(this.dataFile, JSON.stringify(influencers, null, 2));
                    }
                }

                fs.writeFileSync(this.followerUpdatesFile, JSON.stringify(updates, null, 2));
                return updates[updateIndex];
            }
        } catch (error) {
            throw new Error(`Failed to process follower update: ${error.message}`);
        }
    }

    // Get influencer statistics
    async getStats() {
        try {
            const influencers = await this.findAll();

            const stats = {
                total: influencers.length,
                by_status: {
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    suspended: 0,
                    active: 0
                },
                by_tier: {
                    emerging: 0,
                    growing: 0,
                    established: 0,
                    large: 0,
                    major: 0,
                    mega: 0
                },
                by_state: {},
                recent_registrations: 0, // last 7 days
                pending_follower_updates: 0
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            influencers.forEach(influencer => {
                if (influencer.user_status) {
                    stats.by_status[influencer.user_status]++;
                }

                if (influencer.tier) {
                    stats.by_tier[influencer.tier]++;
                }

                if (influencer.state) {
                    stats.by_state[influencer.state] = (stats.by_state[influencer.state] || 0) + 1;
                }

                if (new Date(influencer.created_at) > weekAgo) {
                    stats.recent_registrations++;
                }
            });

            // Count pending follower updates
            const pendingUpdates = await this.getFollowerUpdateRequests({ status: 'pending' });
            stats.pending_follower_updates = pendingUpdates.length;

            return stats;
        } catch (error) {
            throw new Error(`Failed to get influencer stats: ${error.message}`);
        }
    }

    // Search influencers
    async search(searchTerm, filters = {}) {
        try {
            const allInfluencers = await this.findAll(filters);

            if (!searchTerm) {
                return allInfluencers;
            }

            const lowerSearchTerm = searchTerm.toLowerCase();

            return allInfluencers.filter(influencer =>
                (influencer.display_name && influencer.display_name.toLowerCase().includes(lowerSearchTerm)) ||
                (influencer.bio && influencer.bio.toLowerCase().includes(lowerSearchTerm)) ||
                (influencer.city && influencer.city.toLowerCase().includes(lowerSearchTerm)) ||
                (influencer.instagram_username && influencer.instagram_username.toLowerCase().includes(lowerSearchTerm)) ||
                (influencer.tiktok_username && influencer.tiktok_username.toLowerCase().includes(lowerSearchTerm))
            );
        } catch (error) {
            throw new Error(`Failed to search influencers: ${error.message}`);
        }
    }

    // Get Malaysian states
    static getMalaysianStates() {
        return [
            'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
            'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor',
            'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'
        ];
    }

    // Add admin notes
    async addAdminNotes(id, notes, adminId) {
        try {
            return await this.update(id, {
                admin_notes: notes,
                approved_by: adminId,
                approved_at: new Date().toISOString()
            });
        } catch (error) {
            throw new Error(`Failed to add admin notes: ${error.message}`);
        }
    }

    // Get pending approvals
    async getPendingApprovals() {
        return await this.findAll({ status: 'pending' });
    }
}

module.exports = InfluencerMVP;