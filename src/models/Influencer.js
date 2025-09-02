const fs = require('fs');
const path = require('path');

class Influencer {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/influencers.json');
        this.usersFile = path.join(__dirname, '../../data/mvp/users.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
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

    async create(influencerData) {
        try {
            // Calculate tier automatically
            const tier = Influencer.calculateTier(
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
                    ...influencerData,
                    instagram_followers: influencerData.instagram_followers || 0,
                    tiktok_followers: influencerData.tiktok_followers || 0,
                    xhs_followers: influencerData.xhs_followers || 0,
                    youtube_followers: influencerData.youtube_followers || 0,
                    tier,
                    portfolio_images: influencerData.portfolio_images || [],
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

    async findByUserId(userId) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM influencers WHERE user_id = $1',
                    [userId]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return influencers.find(i => i.user_id === userId);
            }
        } catch (error) {
            throw new Error(`Failed to find influencer: ${error.message}`);
        }
    }

    async findById(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT i.*, u.email, u.status as user_status
                     FROM influencers i 
                     JOIN users u ON i.user_id = u.id 
                     WHERE i.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
                
                const influencer = influencers.find(i => i.id === parseInt(id));
                if (influencer) {
                    const user = users.find(u => u.id === influencer.user_id);
                    influencer.email = user?.email;
                    influencer.user_status = user?.status;
                }
                return influencer;
            }
        } catch (error) {
            throw new Error(`Failed to find influencer: ${error.message}`);
        }
    }

    async findAll(filters = {}) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    SELECT i.*, u.email, u.status as user_status, u.created_at as registered_at
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
                
                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }
                
                query += ' ORDER BY i.created_at DESC';
                
                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
                
                let filtered = influencers.map(influencer => {
                    const user = users.find(u => u.id === influencer.user_id);
                    return {
                        ...influencer,
                        email: user?.email,
                        user_status: user?.status,
                        registered_at: user?.created_at
                    };
                });
                
                // Apply filters
                if (filters.status) {
                    filtered = filtered.filter(i => i.user_status === filters.status);
                }
                
                if (filters.tier) {
                    filtered = filtered.filter(i => i.tier === filters.tier);
                }
                
                if (filters.city) {
                    filtered = filtered.filter(i => 
                        i.city?.toLowerCase().includes(filters.city.toLowerCase())
                    );
                }
                
                if (filters.state) {
                    filtered = filtered.filter(i => i.state === filters.state);
                }
                
                return filtered.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
            }
        } catch (error) {
            throw new Error(`Failed to find influencers: ${error.message}`);
        }
    }

    async update(id, updates) {
        try {
            // Recalculate tier if follower counts are being updated
            if (updates.instagram_followers !== undefined || 
                updates.tiktok_followers !== undefined ||
                updates.xhs_followers !== undefined ||
                updates.youtube_followers !== undefined) {
                
                const current = await this.findById(id);
                if (current) {
                    updates.tier = Influencer.calculateTier(
                        updates.instagram_followers ?? current.instagram_followers,
                        updates.tiktok_followers ?? current.tiktok_followers,
                        updates.xhs_followers ?? current.xhs_followers,
                        updates.youtube_followers ?? current.youtube_followers
                    );
                }
            }

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const fields = Object.keys(updates)
                    .map((key, index) => `${key} = $${index + 2}`)
                    .join(', ');
                
                const values = [id, ...Object.values(updates)];
                
                const result = await db.query(
                    `UPDATE influencers SET ${fields} WHERE id = $1 RETURNING *`,
                    values
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = influencers.findIndex(i => i.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('Influencer not found');
                }
                
                influencers[index] = {
                    ...influencers[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                
                fs.writeFileSync(this.dataFile, JSON.stringify(influencers, null, 2));
                return influencers[index];
            }
        } catch (error) {
            throw new Error(`Failed to update influencer: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query('DELETE FROM influencers WHERE id = $1', [id]);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const influencers = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const filtered = influencers.filter(i => i.id !== parseInt(id));
                fs.writeFileSync(this.dataFile, JSON.stringify(filtered, null, 2));
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to delete influencer: ${error.message}`);
        }
    }

    // Get influencers pending approval
    async getPendingApproval() {
        return this.findAll({ status: 'pending' });
    }

    // Approve influencer
    async approve(id, adminId, followerCounts = {}) {
        try {
            // Update follower counts if provided
            const updates = {
                approved_by: adminId,
                approved_at: new Date().toISOString()
            };

            if (followerCounts.instagram_followers !== undefined) {
                updates.instagram_followers = followerCounts.instagram_followers;
            }
            if (followerCounts.tiktok_followers !== undefined) {
                updates.tiktok_followers = followerCounts.tiktok_followers;
            }
            if (followerCounts.xhs_followers !== undefined) {
                updates.xhs_followers = followerCounts.xhs_followers;
            }
            if (followerCounts.youtube_followers !== undefined) {
                updates.youtube_followers = followerCounts.youtube_followers;
            }

            // Update influencer record
            await this.update(id, updates);

            // Update user status
            const influencer = await this.findById(id);
            if (influencer) {
                const User = require('./User');
                const userModel = new User();
                await userModel.updateStatus(influencer.user_id, 'approved');
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to approve influencer: ${error.message}`);
        }
    }

    // Get influencers by tier for campaign matching
    async findByTiers(tiers, filters = {}) {
        const allFilters = { ...filters };
        // For PostgreSQL, we'd use WHERE tier = ANY($1) with tiers array
        // For JSON, we'll filter in memory
        
        try {
            const influencers = await this.findAll(allFilters);
            return influencers.filter(i => tiers.includes(i.tier));
        } catch (error) {
            throw new Error(`Failed to find influencers by tiers: ${error.message}`);
        }
    }

    // Get platform statistics
    async getPlatformStats() {
        try {
            const influencers = await this.findAll({ status: 'approved' });
            
            const stats = {
                total: influencers.length,
                by_tier: {},
                by_platform: {
                    instagram: 0,
                    tiktok: 0,
                    xhs: 0,
                    youtube: 0
                },
                total_followers: {
                    instagram: 0,
                    tiktok: 0,
                    xhs: 0,
                    youtube: 0
                }
            };

            // Initialize tier counts
            Object.keys(Influencer.getTierLabels()).forEach(tier => {
                stats.by_tier[tier] = 0;
            });

            influencers.forEach(influencer => {
                // Count by tier
                if (influencer.tier) {
                    stats.by_tier[influencer.tier]++;
                }

                // Count active platforms and sum followers
                if (influencer.instagram_followers > 0) {
                    stats.by_platform.instagram++;
                    stats.total_followers.instagram += influencer.instagram_followers;
                }
                if (influencer.tiktok_followers > 0) {
                    stats.by_platform.tiktok++;
                    stats.total_followers.tiktok += influencer.tiktok_followers;
                }
                if (influencer.xhs_followers > 0) {
                    stats.by_platform.xhs++;
                    stats.total_followers.xhs += influencer.xhs_followers;
                }
                if (influencer.youtube_followers > 0) {
                    stats.by_platform.youtube++;
                    stats.total_followers.youtube += influencer.youtube_followers;
                }
            });

            return stats;
        } catch (error) {
            throw new Error(`Failed to get platform stats: ${error.message}`);
        }
    }

    // Get platform statistics
    async getPlatformStats() {
        try {
            const influencers = await this.findAll({ status: 'approved' });
            
            const stats = {
                total_influencers: influencers.length,
                by_tier: {},
                by_platform: {
                    instagram: 0,
                    tiktok: 0,
                    xhs: 0,
                    youtube: 0
                },
                total_followers: {
                    instagram: 0,
                    tiktok: 0,
                    xhs: 0,
                    youtube: 0
                }
            };
            
            // Initialize tier counts
            const tiers = Influencer.getTiers();
            tiers.forEach(tier => {
                stats.by_tier[tier] = 0;
            });
            
            influencers.forEach(influencer => {
                // Count by tier
                if (influencer.tier) {
                    stats.by_tier[influencer.tier]++;
                }
                
                // Count by platform and followers
                if (influencer.instagram_followers > 0) {
                    stats.by_platform.instagram++;
                    stats.total_followers.instagram += influencer.instagram_followers;
                }
                if (influencer.tiktok_followers > 0) {
                    stats.by_platform.tiktok++;
                    stats.total_followers.tiktok += influencer.tiktok_followers;
                }
                if (influencer.xhs_followers > 0) {
                    stats.by_platform.xhs++;
                    stats.total_followers.xhs += influencer.xhs_followers;
                }
                if (influencer.youtube_followers > 0) {
                    stats.by_platform.youtube++;
                    stats.total_followers.youtube += influencer.youtube_followers;
                }
            });
            
            return stats;
        } catch (error) {
            throw new Error(`Failed to get platform stats: ${error.message}`);
        }
    }

    // Find influencers by tiers
    async findByTiers(tiers, filters = {}) {
        try {
            const allInfluencers = await this.findAll(filters);
            return allInfluencers.filter(influencer => tiers.includes(influencer.tier));
        } catch (error) {
            throw new Error(`Failed to find influencers by tiers: ${error.message}`);
        }
    }
}

module.exports = Influencer;