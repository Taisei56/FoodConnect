const fs = require('fs');
const path = require('path');

class RestaurantMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/restaurants.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    // Create restaurant profile
    async create(restaurantData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO restaurants (
                        user_id, business_name, description, phone, address, google_maps_link,
                        dietary_categories, city, state, website
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *`,
                    [
                        restaurantData.user_id,
                        restaurantData.business_name,
                        restaurantData.description,
                        restaurantData.phone,
                        restaurantData.address,
                        restaurantData.google_maps_link,
                        restaurantData.dietary_categories || [],
                        restaurantData.city,
                        restaurantData.state,
                        restaurantData.website
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = restaurants.length > 0 ? Math.max(...restaurants.map(r => r.id)) + 1 : 1;

                const restaurant = {
                    id: newId,
                    user_id: restaurantData.user_id,
                    business_name: restaurantData.business_name,
                    description: restaurantData.description,
                    phone: restaurantData.phone,
                    address: restaurantData.address,
                    google_maps_link: restaurantData.google_maps_link,
                    dietary_categories: restaurantData.dietary_categories || [],
                    city: restaurantData.city,
                    state: restaurantData.state,
                    website: restaurantData.website,
                    profile_image: null,
                    admin_notes: null,
                    approved_by: null,
                    approved_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                restaurants.push(restaurant);
                fs.writeFileSync(this.dataFile, JSON.stringify(restaurants, null, 2));
                return restaurant;
            }
        } catch (error) {
            throw new Error(`Failed to create restaurant: ${error.message}`);
        }
    }

    // Find restaurant by user ID
    async findByUserId(userId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM restaurants WHERE user_id = $1',
                    [userId]
                );
                return result.rows[0];
            } catch (dbError) {
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return restaurants.find(r => r.user_id === parseInt(userId));
            }
        } catch (error) {
            console.error('Error finding restaurant by user ID:', error);
            return null;
        }
    }

    // Find restaurant by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM restaurants WHERE id = $1',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return restaurants.find(r => r.id === parseInt(id));
            }
        } catch (error) {
            console.error('Error finding restaurant by ID:', error);
            return null;
        }
    }

    // Get all restaurants with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT r.*, u.email, u.status as user_status
                    FROM restaurants r
                    JOIN users u ON r.user_id = u.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`u.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.city) {
                    conditions.push(`r.city ILIKE $${values.length + 1}`);
                    values.push(`%${filters.city}%`);
                }

                if (filters.state) {
                    conditions.push(`r.state = $${values.length + 1}`);
                    values.push(filters.state);
                }

                if (filters.dietary_category) {
                    conditions.push(`$${values.length + 1} = ANY(r.dietary_categories)`);
                    values.push(filters.dietary_category);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY r.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with users data
                const restaurantsWithUsers = restaurants.map(restaurant => {
                    const user = users.find(u => u.id === restaurant.user_id);
                    return {
                        ...restaurant,
                        email: user?.email,
                        user_status: user?.status
                    };
                });

                let filtered = restaurantsWithUsers;

                if (filters.status) {
                    filtered = filtered.filter(r => r.user_status === filters.status);
                }

                if (filters.city) {
                    filtered = filtered.filter(r => r.city && r.city.toLowerCase().includes(filters.city.toLowerCase()));
                }

                if (filters.state) {
                    filtered = filtered.filter(r => r.state === filters.state);
                }

                if (filters.dietary_category) {
                    filtered = filtered.filter(r => r.dietary_categories && r.dietary_categories.includes(filters.dietary_category));
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find restaurants: ${error.message}`);
        }
    }

    // Update restaurant profile
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
                    `UPDATE restaurants SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = restaurants.findIndex(r => r.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Restaurant not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        restaurants[index][key] = updateData[key];
                    }
                });

                restaurants[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(restaurants, null, 2));
                return restaurants[index];
            }
        } catch (error) {
            throw new Error(`Failed to update restaurant: ${error.message}`);
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

    // Get dietary categories
    static getDietaryCategories() {
        return {
            'halal_certified': 'Halal Certified',
            'halal_friendly': 'Halal-Friendly',
            'non_halal': 'Non-Halal',
            'vegetarian': 'Vegetarian Options',
            'vegan': 'Vegan Options',
            'no_beef': 'No Beef',
            'no_pork': 'No Pork'
        };
    }

    // Get restaurant statistics
    async getStats() {
        try {
            const restaurants = await this.findAll();

            const stats = {
                total: restaurants.length,
                by_status: {
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    suspended: 0,
                    active: 0
                },
                by_state: {},
                recent_registrations: 0 // last 7 days
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            restaurants.forEach(restaurant => {
                if (restaurant.user_status) {
                    stats.by_status[restaurant.user_status]++;
                }

                if (restaurant.state) {
                    stats.by_state[restaurant.state] = (stats.by_state[restaurant.state] || 0) + 1;
                }

                if (new Date(restaurant.created_at) > weekAgo) {
                    stats.recent_registrations++;
                }
            });

            return stats;
        } catch (error) {
            throw new Error(`Failed to get restaurant stats: ${error.message}`);
        }
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

    // Search restaurants
    async search(searchTerm, filters = {}) {
        try {
            const allRestaurants = await this.findAll(filters);

            if (!searchTerm) {
                return allRestaurants;
            }

            const lowerSearchTerm = searchTerm.toLowerCase();

            return allRestaurants.filter(restaurant =>
                (restaurant.business_name && restaurant.business_name.toLowerCase().includes(lowerSearchTerm)) ||
                (restaurant.description && restaurant.description.toLowerCase().includes(lowerSearchTerm)) ||
                (restaurant.city && restaurant.city.toLowerCase().includes(lowerSearchTerm)) ||
                (restaurant.address && restaurant.address.toLowerCase().includes(lowerSearchTerm))
            );
        } catch (error) {
            throw new Error(`Failed to search restaurants: ${error.message}`);
        }
    }
}

module.exports = RestaurantMVP;