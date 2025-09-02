const Restaurant = require('../models/Restaurant');
const UserMVP = require('../models/UserMVP');
const path = require('path');

class RestaurantController {
    static async createProfile(req, res) {
        try {
            const {
                business_name,
                description,
                phone,
                address,
                google_maps_link,
                dietary_categories,
                city,
                state,
                website,
                business_hours
            } = req.body;
            const user_id = req.user.id;

            const existingProfile = await (new Restaurant()).findByUserId(user_id);
            if (existingProfile) {
                return res.status(409).json({ 
                    success: false,
                    error: 'Restaurant profile already exists' 
                });
            }

            const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

            // Parse dietary categories if sent as string
            let parsedDietaryCategories = [];
            if (dietary_categories) {
                try {
                    parsedDietaryCategories = Array.isArray(dietary_categories) 
                        ? dietary_categories 
                        : JSON.parse(dietary_categories);
                } catch (e) {
                    parsedDietaryCategories = [dietary_categories]; // Single value
                }
            }

            // Parse business hours if provided
            let parsedBusinessHours = null;
            if (business_hours) {
                try {
                    parsedBusinessHours = typeof business_hours === 'string' 
                        ? JSON.parse(business_hours) 
                        : business_hours;
                } catch (e) {
                    parsedBusinessHours = null;
                }
            }

            const restaurant = await (new Restaurant()).create({
                user_id,
                business_name: business_name || '',
                description: description || '',
                phone: phone || '',
                address: address || '',
                google_maps_link: google_maps_link || '',
                dietary_categories: parsedDietaryCategories,
                city: city || '',
                state: state || 'Kuala Lumpur',
                website: website || '',
                profile_image,
                business_hours: parsedBusinessHours
            });

            res.status(201).json({
                success: true,
                message: 'Restaurant profile created successfully',
                restaurant,
                dietary_labels: Restaurant.getDietaryCategoryLabels()
            });
        } catch (error) {
            console.error('Create restaurant profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to create restaurant profile' 
            });
        }
    }

    static async getProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const restaurant = await (new Restaurant()).findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Restaurant profile not found' 
                });
            }

            res.json({
                success: true,
                message: 'Restaurant profile retrieved successfully',
                restaurant,
                dietary_categories: Restaurant.getDietaryCategories(),
                dietary_labels: Restaurant.getDietaryCategoryLabels()
            });
        } catch (error) {
            console.error('Get restaurant profile error:', error);
            res.status(500).json({ 
                success: false,
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

            // Parse dietary categories if provided
            if (updates.dietary_categories) {
                try {
                    updates.dietary_categories = Array.isArray(updates.dietary_categories) 
                        ? updates.dietary_categories 
                        : JSON.parse(updates.dietary_categories);
                } catch (e) {
                    updates.dietary_categories = [updates.dietary_categories];
                }
            }

            // Parse business hours if provided
            if (updates.business_hours) {
                try {
                    updates.business_hours = typeof updates.business_hours === 'string' 
                        ? JSON.parse(updates.business_hours) 
                        : updates.business_hours;
                } catch (e) {
                    delete updates.business_hours; // Remove if invalid
                }
            }

            const restaurant = await (new Restaurant()).findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Restaurant profile not found' 
                });
            }

            const updatedRestaurant = await (new Restaurant()).update(restaurant.id, updates);

            res.json({
                success: true,
                message: 'Restaurant profile updated successfully',
                restaurant: updatedRestaurant
            });
        } catch (error) {
            console.error('Update restaurant profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update restaurant profile' 
            });
        }
    }

    static async getAllRestaurants(req, res) {
        try {
            const { 
                city, 
                state, 
                dietary_categories, 
                has_google_maps,
                status = 'approved',
                page = 1 
            } = req.query;
            
            const limit = 12;
            const offset = (page - 1) * limit;
            
            const filters = { status };
            if (city) filters.city = city;
            if (state) filters.state = state;
            
            let restaurants = await (new Restaurant()).findAll(filters);
            
            // Additional filtering
            if (dietary_categories) {
                const requestedCategories = dietary_categories.split(',');
                restaurants = restaurants.filter(r => {
                    if (!r.dietary_categories || r.dietary_categories.length === 0) return false;
                    return requestedCategories.some(cat => r.dietary_categories.includes(cat));
                });
            }

            if (has_google_maps === 'true') {
                restaurants = restaurants.filter(r => r.google_maps_link && r.google_maps_link.length > 0);
            }

            const total = restaurants.length;
            const totalPages = Math.ceil(total / limit);
            const paginatedRestaurants = restaurants.slice(offset, offset + limit);

            // Enrich restaurant data
            const enrichedRestaurants = paginatedRestaurants.map(restaurant => ({
                ...restaurant,
                dietary_labels: (restaurant.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                has_google_maps: !!(restaurant.google_maps_link && restaurant.google_maps_link.length > 0),
                has_website: !!(restaurant.website && restaurant.website.length > 0),
                verified: restaurant.user_status === 'approved'
            }));

            res.json({
                success: true,
                message: 'Restaurants retrieved successfully',
                restaurants: enrichedRestaurants,
                dietary_categories: Restaurant.getDietaryCategories(),
                dietary_labels: Restaurant.getDietaryCategoryLabels(),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error('Get all restaurants error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve restaurants' 
            });
        }
    }

    static async getRestaurantById(req, res) {
        try {
            const { id } = req.params;
            
            const restaurant = await (new Restaurant()).findById(id);
            if (!restaurant) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Restaurant not found' 
                });
            }

            // Enrich restaurant data
            const enrichedRestaurant = {
                ...restaurant,
                dietary_labels: (restaurant.dietary_categories || [])
                    .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                    .filter(Boolean),
                has_google_maps: !!(restaurant.google_maps_link && restaurant.google_maps_link.length > 0),
                has_website: !!(restaurant.website && restaurant.website.length > 0),
                verified: restaurant.user_status === 'approved'
            };

            res.json({
                success: true,
                message: 'Restaurant retrieved successfully',
                restaurant: enrichedRestaurant
            });
        } catch (error) {
            console.error('Get restaurant by ID error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve restaurant' 
            });
        }
    }

    static async deleteProfile(req, res) {
        try {
            const user_id = req.user.id;
            
            const restaurant = await (new Restaurant()).findByUserId(user_id);
            if (!restaurant) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Restaurant profile not found' 
                });
            }

            await (new Restaurant()).delete(restaurant.id);

            res.json({
                success: true,
                message: 'Restaurant profile deleted successfully'
            });
        } catch (error) {
            console.error('Delete restaurant profile error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to delete restaurant profile' 
            });
        }
    }

    static async getRestaurantsByLocation(req, res) {
        try {
            const { city, state } = req.query;
            
            if (!city && !state) {
                return res.status(400).json({
                    success: false,
                    error: 'Please provide city or state parameter'
                });
            }

            const filters = { status: 'approved' };
            if (city) filters.city = city;
            if (state) filters.state = state;

            const restaurants = await (new Restaurant()).findAll(filters);

            res.json({
                success: true,
                message: 'Restaurants retrieved successfully',
                restaurants: restaurants.map(restaurant => ({
                    ...restaurant,
                    dietary_labels: (restaurant.dietary_categories || [])
                        .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                        .filter(Boolean)
                }))
            });
        } catch (error) {
            console.error('Get restaurants by location error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve restaurants by location'
            });
        }
    }

    static async getRestaurantsByDietary(req, res) {
        try {
            const { categories } = req.query; // comma-separated list
            
            if (!categories) {
                return res.status(400).json({
                    success: false,
                    error: 'Please provide dietary categories'
                });
            }

            const requestedCategories = categories.split(',');
            const validCategories = Restaurant.getDietaryCategories();
            
            // Validate categories
            const invalidCategories = requestedCategories.filter(cat => !validCategories.includes(cat));
            if (invalidCategories.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid dietary categories: ${invalidCategories.join(', ')}`,
                    valid_categories: validCategories
                });
            }

            const restaurants = await (new Restaurant()).findAll({ status: 'approved' });
            
            // Filter by dietary categories
            const filteredRestaurants = restaurants.filter(r => {
                if (!r.dietary_categories || r.dietary_categories.length === 0) return false;
                return requestedCategories.some(cat => r.dietary_categories.includes(cat));
            });

            res.json({
                success: true,
                message: 'Restaurants retrieved successfully',
                restaurants: filteredRestaurants.map(restaurant => ({
                    ...restaurant,
                    dietary_labels: (restaurant.dietary_categories || [])
                        .map(cat => Restaurant.getDietaryCategoryLabels()[cat])
                        .filter(Boolean),
                    matching_categories: restaurant.dietary_categories.filter(cat => 
                        requestedCategories.includes(cat)
                    )
                })),
                requested_categories: requestedCategories,
                category_labels: Restaurant.getDietaryCategoryLabels()
            });
        } catch (error) {
            console.error('Get restaurants by dietary error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve restaurants by dietary preferences'
            });
        }
    }

    static async getLocationStats(req, res) {
        try {
            const restaurants = await (new Restaurant()).findAll({ status: 'approved' });
            
            const locationStats = {
                by_state: {},
                by_city: {},
                total_locations: 0,
                states_covered: 0,
                cities_covered: 0
            };

            const citySet = new Set();
            const stateSet = new Set();

            restaurants.forEach(restaurant => {
                if (restaurant.state) {
                    locationStats.by_state[restaurant.state] = 
                        (locationStats.by_state[restaurant.state] || 0) + 1;
                    stateSet.add(restaurant.state);
                }

                if (restaurant.city) {
                    locationStats.by_city[restaurant.city] = 
                        (locationStats.by_city[restaurant.city] || 0) + 1;
                    citySet.add(restaurant.city);
                }
            });

            locationStats.total_locations = restaurants.length;
            locationStats.states_covered = stateSet.size;
            locationStats.cities_covered = citySet.size;

            res.json({
                success: true,
                message: 'Location statistics retrieved successfully',
                stats: locationStats
            });
        } catch (error) {
            console.error('Get location stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve location statistics'
            });
        }
    }
}

module.exports = RestaurantController;