const { Influencer, User } = require('../models');

class InfluencerController {
    static async createProfile(req, res) {
        try {
            const { display_name, instagram_handle, follower_count, location, bio } = req.body;
            const user_id = req.user.id;

            const existingProfile = await Influencer.findByUserId(user_id);
            if (existingProfile) {
                return res.status(409).json({ 
                    error: 'Influencer profile already exists' 
                });
            }

            const profile_image = req.files && req.files.profile_image ? 
                `/uploads/${req.files.profile_image[0].filename}` : null;

            const portfolio_images = req.files && req.files.portfolio_images ? 
                req.files.portfolio_images.map(file => `/uploads/${file.filename}`) : [];

            const influencer = await Influencer.create({
                user_id,
                display_name,
                instagram_handle: instagram_handle ? (instagram_handle.startsWith('@') ? instagram_handle : `@${instagram_handle}`) : null,
                follower_count: follower_count ? parseInt(follower_count) : null,
                location,
                bio,
                profile_image,
                portfolio_images
            });

            res.status(201).json({
                message: 'Influencer profile created successfully',
                influencer
            });
        } catch (error) {
            console.error('Create influencer profile error:', error);
            res.status(500).json({ 
                error: 'Failed to create influencer profile' 
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const influencer = await Influencer.findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    error: 'Influencer profile not found' 
                });
            }

            res.json({
                message: 'Influencer profile retrieved successfully',
                influencer
            });
        } catch (error) {
            console.error('Get influencer profile error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve influencer profile' 
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const user_id = req.user.id;
            const updates = { ...req.body };

            if (updates.instagram_handle && !updates.instagram_handle.startsWith('@')) {
                updates.instagram_handle = `@${updates.instagram_handle}`;
            }

            if (updates.follower_count) {
                updates.follower_count = parseInt(updates.follower_count);
            }

            if (req.files && req.files.profile_image) {
                updates.profile_image = `/uploads/${req.files.profile_image[0].filename}`;
            }

            if (req.files && req.files.portfolio_images) {
                const newPortfolioImages = req.files.portfolio_images.map(file => `/uploads/${file.filename}`);
                
                const existingInfluencer = await Influencer.findByUserId(user_id);
                const existingPortfolio = existingInfluencer ? existingInfluencer.portfolio_images || [] : [];
                
                updates.portfolio_images = [...existingPortfolio, ...newPortfolioImages];
            }

            const influencer = await Influencer.findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    error: 'Influencer profile not found' 
                });
            }

            const updatedInfluencer = await Influencer.update(influencer.id, updates);

            res.json({
                message: 'Influencer profile updated successfully',
                influencer: updatedInfluencer
            });
        } catch (error) {
            console.error('Update influencer profile error:', error);
            res.status(500).json({ 
                error: 'Failed to update influencer profile' 
            });
        }
    }

    static async getAllInfluencers(req, res) {
        try {
            const { location, min_followers, primary_platform, page = 1 } = req.query;
            const limit = 10;
            const offset = (page - 1) * limit;
            
            let influencers;
            
            if (location) {
                influencers = await Influencer.getByLocation(location);
            } else {
                influencers = await Influencer.getAll();
                influencers = influencers.filter(i => i.user_status === 'approved');
            }
            
            if (min_followers) {
                const minFollowers = parseInt(min_followers);
                influencers = influencers.filter(i => 
                    i.follower_count && i.follower_count >= minFollowers
                );
            }

            if (primary_platform) {
                influencers = influencers.filter(i => 
                    i.primary_platform && i.primary_platform.toLowerCase() === primary_platform.toLowerCase()
                );
            }

            const total = influencers.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedInfluencers = influencers.slice(offset, offset + limit);

            // Add mock data for display
            const enrichedInfluencers = paginatedInfluencers.map(influencer => ({
                ...influencer,
                name: influencer.display_name || 'Unnamed Influencer',
                followers_count: influencer.follower_count || 0,
                collaborations: Math.floor(Math.random() * 50) + 1,
                avg_engagement: (Math.random() * 10 + 2).toFixed(1),
                primary_platform: influencer.primary_platform || (influencer.instagram_handle ? 'Instagram' : 'Not specified'),
                profile_picture: influencer.profile_image
            }));

            res.json({
                message: 'Influencers retrieved successfully',
                influencers: enrichedInfluencers,
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
                error: 'Failed to retrieve influencers' 
            });
        }
    }

    static async getInfluencerById(req, res) {
        try {
            const { id } = req.params;
            
            const influencer = await Influencer.findById(id);
            if (!influencer) {
                return res.status(404).json({ 
                    error: 'Influencer not found' 
                });
            }

            res.json({
                message: 'Influencer retrieved successfully',
                influencer
            });
        } catch (error) {
            console.error('Get influencer by ID error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve influencer' 
            });
        }
    }

    static async removePortfolioImage(req, res) {
        try {
            const user_id = req.user.id;
            const { imageUrl } = req.body;

            const influencer = await Influencer.findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    error: 'Influencer profile not found' 
                });
            }

            const updatedPortfolio = (influencer.portfolio_images || []).filter(
                img => img !== imageUrl
            );

            const updatedInfluencer = await Influencer.update(influencer.id, {
                portfolio_images: updatedPortfolio
            });

            res.json({
                message: 'Portfolio image removed successfully',
                influencer: updatedInfluencer
            });
        } catch (error) {
            console.error('Remove portfolio image error:', error);
            res.status(500).json({ 
                error: 'Failed to remove portfolio image' 
            });
        }
    }

    static async deleteProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const influencer = await Influencer.findByUserId(user_id);
            if (!influencer) {
                return res.status(404).json({ 
                    error: 'Influencer profile not found' 
                });
            }

            await Influencer.delete(influencer.id);

            res.json({
                message: 'Influencer profile deleted successfully'
            });
        } catch (error) {
            console.error('Delete influencer profile error:', error);
            res.status(500).json({ 
                error: 'Failed to delete influencer profile' 
            });
        }
    }
}

module.exports = InfluencerController;