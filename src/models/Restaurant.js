const fs = require('fs');
const path = require('path');

class Restaurant {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/restaurants.json');
        this.usersFile = path.join(__dirname, '../../data/mvp/users.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    async create(restaurantData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO restaurants (
                        user_id, business_name, description, phone, address, 
                        google_maps_link, dietary_categories, city, state, website
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
                    ...restaurantData,
                    dietary_categories: restaurantData.dietary_categories || [],
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

    async findByUserId(userId) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM restaurants WHERE user_id = $1',
                    [userId]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return restaurants.find(r => r.user_id === userId);
            }
        } catch (error) {
            throw new Error(`Failed to find restaurant: ${error.message}`);
        }
    }

    async findById(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT r.*, u.email, u.status as user_status
                     FROM restaurants r 
                     JOIN users u ON r.user_id = u.id 
                     WHERE r.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
                
                const restaurant = restaurants.find(r => r.id === parseInt(id));
                if (restaurant) {
                    const user = users.find(u => u.id === restaurant.user_id);
                    restaurant.email = user?.email;
                    restaurant.user_status = user?.status;
                }
                return restaurant;
            }
        } catch (error) {
            throw new Error(`Failed to find restaurant: ${error.message}`);
        }
    }

    async findAll(filters = {}) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    SELECT r.*, u.email, u.status as user_status, u.created_at as registered_at
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
                
                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }
                
                query += ' ORDER BY r.created_at DESC';
                
                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
                
                let filtered = restaurants.map(restaurant => {
                    const user = users.find(u => u.id === restaurant.user_id);
                    return {
                        ...restaurant,
                        email: user?.email,
                        user_status: user?.status,
                        registered_at: user?.created_at
                    };
                });
                
                // Apply filters
                if (filters.status) {
                    filtered = filtered.filter(r => r.user_status === filters.status);
                }
                
                if (filters.city) {
                    filtered = filtered.filter(r => 
                        r.city?.toLowerCase().includes(filters.city.toLowerCase())
                    );
                }
                
                if (filters.state) {
                    filtered = filtered.filter(r => r.state === filters.state);
                }
                
                return filtered.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                );
            }
        } catch (error) {
            throw new Error(`Failed to find restaurants: ${error.message}`);
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
                    `UPDATE restaurants SET ${fields} WHERE id = $1 RETURNING *`,
                    values
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = restaurants.findIndex(r => r.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('Restaurant not found');
                }
                
                restaurants[index] = {
                    ...restaurants[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                
                fs.writeFileSync(this.dataFile, JSON.stringify(restaurants, null, 2));
                return restaurants[index];
            }
        } catch (error) {
            throw new Error(`Failed to update restaurant: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query('DELETE FROM restaurants WHERE id = $1', [id]);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const restaurants = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const filtered = restaurants.filter(r => r.id !== parseInt(id));
                fs.writeFileSync(this.dataFile, JSON.stringify(filtered, null, 2));
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to delete restaurant: ${error.message}`);
        }
    }

    // Get restaurants pending approval
    async getPendingApproval() {
        return this.findAll({ status: 'pending' });
    }

    // Approve restaurant
    async approve(id, adminId) {
        try {
            // Update restaurant record
            await this.update(id, {
                approved_by: adminId,
                approved_at: new Date().toISOString()
            });

            // Update user status
            const restaurant = await this.findById(id);
            if (restaurant) {
                const User = require('./User');
                const userModel = new User();
                await userModel.updateStatus(restaurant.user_id, 'approved');
            }

            return true;
        } catch (error) {
            throw new Error(`Failed to approve restaurant: ${error.message}`);
        }
    }

    // Get dietary categories enum
    static getDietaryCategories() {
        return [
            'halal_certified',
            'halal_friendly',
            'non_halal',
            'vegetarian',
            'vegan',
            'no_beef',
            'no_pork'
        ];
    }

    // Get dietary category labels
    static getDietaryCategoryLabels() {
        return {
            'halal_certified': 'Halal Certified',
            'halal_friendly': 'Halal Friendly',
            'non_halal': 'Non-Halal',
            'vegetarian': 'Vegetarian Options',
            'vegan': 'Vegan Options',
            'no_beef': 'No Beef',
            'no_pork': 'No Pork'
        };
    }
}

module.exports = Restaurant;