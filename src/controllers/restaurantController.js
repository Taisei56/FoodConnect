const { Restaurant, User } = require('../models');
const path = require('path');

class RestaurantController {
    static async createProfile(req, res) {
        try {
            const { business_name, location, cuisine_type, phone, description } = req.body;
            const user_id = req.user.id;

            const existingProfile = await Restaurant.findByUserId(user_id);
            if (existingProfile) {
                return res.status(409).json({ 
                    error: 'Restaurant profile already exists' 
                });
            }

            const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

            const restaurant = await Restaurant.create({
                user_id,
                business_name,
                location,
                cuisine_type,
                phone,
                description,
                profile_image
            });

            res.status(201).json({
                message: 'Restaurant profile created successfully',
                restaurant
            });
        } catch (error) {
            console.error('Create restaurant profile error:', error);
            res.status(500).json({ 
                error: 'Failed to create restaurant profile' 
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const restaurant = await Restaurant.findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    error: 'Restaurant profile not found' 
                });
            }

            res.json({
                message: 'Restaurant profile retrieved successfully',
                restaurant
            });
        } catch (error) {
            console.error('Get restaurant profile error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve restaurant profile' 
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const user_id = req.user.id;
            const updates = { ...req.body };

            if (req.file) {
                updates.profile_image = `/uploads/${req.file.filename}`;
            }

            const restaurant = await Restaurant.findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    error: 'Restaurant profile not found' 
                });
            }

            const updatedRestaurant = await Restaurant.update(restaurant.id, updates);

            res.json({
                message: 'Restaurant profile updated successfully',
                restaurant: updatedRestaurant
            });
        } catch (error) {
            console.error('Update restaurant profile error:', error);
            res.status(500).json({ 
                error: 'Failed to update restaurant profile' 
            });
        }
    }

    static async getAllRestaurants(req, res) {
        try {
            const { location, cuisine_type } = req.query;
            
            const restaurants = await Restaurant.getAll();
            
            let filteredRestaurants = restaurants.filter(r => r.user_status === 'approved');
            
            if (location) {
                filteredRestaurants = filteredRestaurants.filter(r => 
                    r.location.toLowerCase().includes(location.toLowerCase())
                );
            }
            
            if (cuisine_type) {
                filteredRestaurants = filteredRestaurants.filter(r => 
                    r.cuisine_type && r.cuisine_type.toLowerCase().includes(cuisine_type.toLowerCase())
                );
            }

            res.json({
                message: 'Restaurants retrieved successfully',
                restaurants: filteredRestaurants,
                total: filteredRestaurants.length
            });
        } catch (error) {
            console.error('Get all restaurants error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve restaurants' 
            });
        }
    }

    static async getRestaurantById(req, res) {
        try {
            const { id } = req.params;
            
            const restaurant = await Restaurant.findById(id);
            if (!restaurant) {
                return res.status(404).json({ 
                    error: 'Restaurant not found' 
                });
            }

            res.json({
                message: 'Restaurant retrieved successfully',
                restaurant
            });
        } catch (error) {
            console.error('Get restaurant by ID error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve restaurant' 
            });
        }
    }

    static async deleteProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const restaurant = await Restaurant.findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    error: 'Restaurant profile not found' 
                });
            }

            await Restaurant.delete(restaurant.id);

            res.json({
                message: 'Restaurant profile deleted successfully'
            });
        } catch (error) {
            console.error('Delete restaurant profile error:', error);
            res.status(500).json({ 
                error: 'Failed to delete restaurant profile' 
            });
        }
    }
}

module.exports = RestaurantController;