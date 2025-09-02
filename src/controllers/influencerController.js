const Influencer = require('../models/Influencer');
const UserMVP = require('../models/UserMVP');

class InfluencerController {
    static async createProfile(req, res) {
        try {
            const {
                display_name,
                phone,
                bio,
                location,
                city,
                state,
                instagram_username,
                instagram_link,
                instagram_followers,
                tiktok_username,
                tiktok_link,
                tiktok_followers,
                xhs_username,
                xhs_link,
                xhs_followers,
                youtube_channel,
                youtube_followers
            } = req.body;
            const user_id = req.user.id;

            const existingProfile = await (new Influencer()).findByUserId(user_id);
            if (existingProfile) {
                return res.status(409).json({ 
                    success: false,
                    error: 'Influencer profile already exists' 
                });
            }

            const profile_image = req.files && req.files.profile_image ? 
                `/uploads/${req.files.profile_image[0].filename}` : null;

            const portfolio_images = req.files && req.files.portfolio_images ? 
                req.files.portfolio_images.map(file => `/uploads/${file.filename}`) : [];

            const influencer = await (new Influencer()).create({
                user_id,
                display_name: display_name || '',
                phone: phone || '',
                bio: bio || '',
                location: location || '',
                city: city || '',
                state: state || 'Kuala Lumpur',
                instagram_username: instagram_username || '',
                instagram_link: instagram_link || '',
                instagram_followers: parseInt(instagram_followers) || 0,
                tiktok_username: tiktok_username || '',
                tiktok_link: tiktok_link || '',
                tiktok_followers: parseInt(tiktok_followers) || 0,
                xhs_username: xhs_username || '',
                xhs_link: xhs_link || '',
                xhs_followers: parseInt(xhs_followers) || 0,
                youtube_channel: youtube_channel || '',
                youtube_followers: parseInt(youtube_followers) || 0,
                profile_image,
                portfolio_images
            });

            res.status(201).json({
                success: true,
                message: 'Influencer profile created successfully',
                influencer,
                tier: influencer.tier,
                tier_label: Influencer.getTierLabels()[influencer.tier]
            });
        } catch (error) {
            console.error('Create influencer profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to create influencer profile' 
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const influencer = await (new Influencer()).findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Influencer profile not found' 
                });
            }

            res.json({
                success: true,
                message: 'Influencer profile retrieved successfully',
                influencer,
                tier_label: Influencer.getTierLabels()[influencer.tier],
                tier_description: Influencer.getTierDescriptions()[influencer.tier]
            });
        } catch (error) {
            console.error('Get influencer profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve influencer profile' 
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const user_id = req.user.id;
            const updates = { ...req.body };

            if (req.files && req.files.profile_image) {
                updates.profile_image = `/uploads/${req.files.profile_image[0].filename}`;
            }

            // Handle social media follower counts
            if (updates.instagram_followers) {
                updates.instagram_followers = parseInt(updates.instagram_followers);
            }
            if (updates.tiktok_followers) {
                updates.tiktok_followers = parseInt(updates.tiktok_followers);
            }
            if (updates.xhs_followers) {
                updates.xhs_followers = parseInt(updates.xhs_followers);
            }
            if (updates.youtube_followers) {
                updates.youtube_followers = parseInt(updates.youtube_followers);
            }

            if (req.files && req.files.portfolio_images) {
                const newPortfolioImages = req.files.portfolio_images.map(file => `/uploads/${file.filename}`);
                
                const existingInfluencer = await (new Influencer()).findByUserId(user_id);
                const existingPortfolio = existingInfluencer ? existingInfluencer.portfolio_images || [] : [];
                
                updates.portfolio_images = [...existingPortfolio, ...newPortfolioImages];
            }

            const influencer = await (new Influencer()).findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Influencer profile not found' 
                });
            }

            const updatedInfluencer = await (new Influencer()).update(influencer.id, updates);

            res.json({
                success: true,
                message: 'Influencer profile updated successfully',
                influencer: updatedInfluencer,
                tier_label: Influencer.getTierLabels()[updatedInfluencer.tier],
                tier_description: Influencer.getTierDescriptions()[updatedInfluencer.tier]
            });
        } catch (error) {
            console.error('Update influencer profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update influencer profile' 
            });
        }
    }

    static async getAllInfluencers(req, res) {
        try {
            const { 
                city, 
                state, 
                tier, 
                min_followers, 
                platform, 
                status = 'approved',
                page = 1 
            } = req.query;
            const limit = 12;
            const offset = (page - 1) * limit;
            
            const filters = { status };
            if (city) filters.city = city;
            if (state) filters.state = state;
            if (tier) filters.tier = tier;
            
            let influencers = await (new Influencer()).findAll(filters);
            
            // Additional filtering
            if (min_followers) {
                const minFollowers = parseInt(min_followers);
                influencers = influencers.filter(i => {
                    const maxFollowers = Math.max(
                        i.instagram_followers || 0,
                        i.tiktok_followers || 0,
                        i.xhs_followers || 0,
                        i.youtube_followers || 0
                    );
                    return maxFollowers >= minFollowers;
                });
            }

            if (platform) {
                influencers = influencers.filter(i => {
                    switch (platform.toLowerCase()) {
                        case 'instagram': return (i.instagram_followers || 0) > 0;
                        case 'tiktok': return (i.tiktok_followers || 0) > 0;
                        case 'xhs': return (i.xhs_followers || 0) > 0;
                        case 'youtube': return (i.youtube_followers || 0) > 0;
                        default: return true;
                    }
                });
            }

            const total = influencers.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedInfluencers = influencers.slice(offset, offset + limit);

            // Enrich influencer data with calculated fields
            const enrichedInfluencers = paginatedInfluencers.map(influencer => {
                const maxFollowers = Math.max(
                    influencer.instagram_followers || 0,
                    influencer.tiktok_followers || 0,
                    influencer.xhs_followers || 0,
                    influencer.youtube_followers || 0
                );
                
                // Determine primary platform
                let primaryPlatform = 'None';
                if (influencer.instagram_followers === maxFollowers && maxFollowers > 0) primaryPlatform = 'Instagram';
                else if (influencer.tiktok_followers === maxFollowers && maxFollowers > 0) primaryPlatform = 'TikTok';
                else if (influencer.xhs_followers === maxFollowers && maxFollowers > 0) primaryPlatform = 'XHS';
                else if (influencer.youtube_followers === maxFollowers && maxFollowers > 0) primaryPlatform = 'YouTube';
                
                return {
                    ...influencer,
                    name: influencer.display_name || 'Unnamed Influencer',
                    max_followers: maxFollowers,
                    primary_platform: primaryPlatform,
                    tier_label: Influencer.getTierLabels()[influencer.tier] || 'Unranked',
                    tier_description: Influencer.getTierDescriptions()[influencer.tier] || '',
                    platforms_active: [
                        influencer.instagram_followers > 0 ? 'Instagram' : null,
                        influencer.tiktok_followers > 0 ? 'TikTok' : null,
                        influencer.xhs_followers > 0 ? 'XHS' : null,
                        influencer.youtube_followers > 0 ? 'YouTube' : null
                    ].filter(Boolean)
                };
            });

            res.json({
                success: true,
                message: 'Influencers retrieved successfully',
                influencers: enrichedInfluencers,
                tier_labels: Influencer.getTierLabels(),
                tier_descriptions: Influencer.getTierDescriptions(),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error('Get all influencers error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve influencers' 
            });
        }
    }

    static async getInfluencerById(req, res) {
        try {
            const { id } = req.params;
            
            const influencer = await (new Influencer()).findById(id);
            if (!influencer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Influencer not found' 
                });
            }

            // Calculate additional metrics
            const maxFollowers = Math.max(
                influencer.instagram_followers || 0,
                influencer.tiktok_followers || 0,
                influencer.xhs_followers || 0,
                influencer.youtube_followers || 0
            );

            const enrichedInfluencer = {
                ...influencer,
                max_followers: maxFollowers,
                tier_label: Influencer.getTierLabels()[influencer.tier],
                tier_description: Influencer.getTierDescriptions()[influencer.tier],
                platforms: {
                    instagram: {
                        active: influencer.instagram_followers > 0,
                        username: influencer.instagram_username,
                        link: influencer.instagram_link,
                        followers: influencer.instagram_followers || 0
                    },
                    tiktok: {
                        active: influencer.tiktok_followers > 0,
                        username: influencer.tiktok_username,
                        link: influencer.tiktok_link,
                        followers: influencer.tiktok_followers || 0
                    },
                    xhs: {
                        active: influencer.xhs_followers > 0,
                        username: influencer.xhs_username,
                        link: influencer.xhs_link,
                        followers: influencer.xhs_followers || 0
                    },
                    youtube: {
                        active: influencer.youtube_followers > 0,
                        channel: influencer.youtube_channel,
                        followers: influencer.youtube_followers || 0
                    }
                }
            };

            res.json({
                success: true,
                message: 'Influencer retrieved successfully',
                influencer: enrichedInfluencer
            });
        } catch (error) {
            console.error('Get influencer by ID error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve influencer' 
            });
        }
    }

    static async removePortfolioImage(req, res) {
        try {
            const user_id = req.user.id;
            const { imageUrl } = req.body;

            const influencer = await (new Influencer()).findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Influencer profile not found' 
                });
            }

            const updatedPortfolio = (influencer.portfolio_images || []).filter(
                img => img !== imageUrl
            );

            const updatedInfluencer = await (new Influencer()).update(influencer.id, {
                portfolio_images: updatedPortfolio
            });

            res.json({
                success: true,
                message: 'Portfolio image removed successfully',
                influencer: updatedInfluencer
            });
        } catch (error) {
            console.error('Remove portfolio image error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to remove portfolio image' 
            });
        }
    }

    static async deleteProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const influencer = await (new Influencer()).findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Influencer profile not found' 
                });
            }

            await (new Influencer()).delete(influencer.id);

            res.json({
                success: true,
                message: 'Influencer profile deleted successfully'
            });
        } catch (error) {
            console.error('Delete influencer profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to delete influencer profile' 
            });
        }
    }

    // New methods for follower count management
    static async requestFollowerUpdate(req, res) {
        try {
            const user_id = req.user.id;
            const { platform, requested_count, evidence_url } = req.body;

            if (!['instagram', 'tiktok', 'xhs', 'youtube'].includes(platform)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid platform. Must be instagram, tiktok, xhs, or youtube.'
                });
            }

            const influencer = await (new Influencer()).findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            // Create follower update request (would store in follower_updates table)
            // For now, return success - admin will handle this
            
            res.json({
                success: true,
                message: 'Follower count update request submitted successfully. Admin will review and approve.',
                request: {
                    platform,
                    requested_count: parseInt(requested_count),
                    current_count: influencer[`${platform}_followers`] || 0,
                    evidence_url,
                    status: 'pending'
                }
            });
        } catch (error) {
            console.error('Request follower update error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to submit follower update request'
            });
        }
    }

    static async getInfluencerStats(req, res) {
        try {
            const stats = await (new Influencer()).getPlatformStats();
            res.json({
                success: true,
                message: 'Platform statistics retrieved successfully',
                stats
            });
        } catch (error) {
            console.error('Get influencer stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve platform statistics'
            });
        }
    }

    static async getInfluencersByTier(req, res) {
        try {
            const { tiers } = req.query; // comma-separated list of tiers
            const tierArray = tiers ? tiers.split(',') : [];
            
            if (tierArray.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Please provide at least one tier'
                });
            }

            const influencers = await (new Influencer()).findByTiers(tierArray, { status: 'approved' });
            
            res.json({
                success: true,
                message: 'Influencers retrieved successfully',
                influencers: influencers.map(influencer => ({
                    ...influencer,
                    tier_label: Influencer.getTierLabels()[influencer.tier],
                    max_followers: Math.max(
                        influencer.instagram_followers || 0,
                        influencer.tiktok_followers || 0,
                        influencer.xhs_followers || 0,
                        influencer.youtube_followers || 0
                    )
                }))
            });
        } catch (error) {
            console.error('Get influencers by tier error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve influencers by tier'
            });
        }
    }
}

module.exports = InfluencerController;