// Use simple-db for consistent behavior across all environments
const { query } = require('../config/simple-db');

const User = {
    async create({ email, password_hash, user_type }) {
        const result = await query(
            'INSERT INTO users (email, password_hash, user_type) VALUES ($1, $2, $3) RETURNING *',
            [email, password_hash, user_type]
        );
        return result.rows[0];
    },

    async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    async findById(id) {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async updateStatus(id, status) {
        const result = await query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    },

    async getAll(filters = {}) {
        let whereClause = [];
        let params = [];
        let paramCount = 0;

        if (filters.user_type) {
            whereClause.push(`user_type = $${++paramCount}`);
            params.push(filters.user_type);
        }

        if (filters.status) {
            whereClause.push(`status = $${++paramCount}`);
            params.push(filters.status);
        }

        const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        const result = await query(
            `SELECT * FROM users ${whereString} ORDER BY created_at DESC`,
            params
        );
        return result.rows;
    }
};

const Restaurant = {
    async create({ user_id, business_name, location, cuisine_type, phone, description, profile_image }) {
        const result = await query(
            `INSERT INTO restaurants (user_id, business_name, location, cuisine_type, phone, description, profile_image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [user_id, business_name, location, cuisine_type, phone, description, profile_image]
        );
        return result.rows[0];
    },

    async findByUserId(user_id) {
        const result = await query('SELECT * FROM restaurants WHERE user_id = $1', [user_id]);
        return result.rows[0];
    },

    async findById(id) {
        const result = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
        return result.rows[0];
    },

    async update(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        
        const result = await query(
            `UPDATE restaurants SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
            [...values, id]
        );
        return result.rows[0];
    },

    async getAll() {
        const result = await query(`
            SELECT r.*, u.email, u.status as user_status 
            FROM restaurants r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        `);
        return result.rows;
    },

    async delete(id) {
        const result = await query(
            'DELETE FROM restaurants WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

const Influencer = {
    async create({ user_id, display_name, instagram_handle, follower_count, location, bio, profile_image, portfolio_images }) {
        const result = await query(
            `INSERT INTO influencers (user_id, display_name, instagram_handle, follower_count, location, bio, profile_image, portfolio_images) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [user_id, display_name, instagram_handle, follower_count, location, bio, profile_image, portfolio_images]
        );
        return result.rows[0];
    },

    async findByUserId(user_id) {
        const result = await query('SELECT * FROM influencers WHERE user_id = $1', [user_id]);
        return result.rows[0];
    },

    async findById(id) {
        const result = await query('SELECT * FROM influencers WHERE id = $1', [id]);
        return result.rows[0];
    },

    async update(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        
        const result = await query(
            `UPDATE influencers SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
            [...values, id]
        );
        return result.rows[0];
    },

    async getAll() {
        const result = await query(`
            SELECT i.*, u.email, u.status as user_status 
            FROM influencers i 
            JOIN users u ON i.user_id = u.id 
            ORDER BY i.created_at DESC
        `);
        return result.rows;
    },

    async getByLocation(location) {
        const result = await query(`
            SELECT i.*, u.email, u.status as user_status 
            FROM influencers i 
            JOIN users u ON i.user_id = u.id 
            WHERE i.location ILIKE $1 AND u.status = 'approved'
            ORDER BY i.follower_count DESC
        `, [`%${location}%`]);
        return result.rows;
    },

    async delete(id) {
        const result = await query(
            'DELETE FROM influencers WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

const Campaign = {
    async create({ restaurant_id, title, description, budget_per_influencer, meal_value, max_influencers, requirements, location, deadline }) {
        const result = await query(
            `INSERT INTO campaigns (restaurant_id, title, description, budget_per_influencer, meal_value, max_influencers, requirements, location, deadline) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [restaurant_id, title, description, budget_per_influencer, meal_value, max_influencers, requirements, location, deadline]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await query(`
            SELECT c.*, r.business_name, r.location as restaurant_location, r.profile_image as restaurant_image
            FROM campaigns c 
            JOIN restaurants r ON c.restaurant_id = r.id 
            WHERE c.id = $1
        `, [id]);
        return result.rows[0];
    },

    async getAll(filters = {}) {
        let whereClause = [];
        let params = [];
        let paramCount = 0;

        if (filters.status) {
            whereClause.push(`c.status = $${++paramCount}`);
            params.push(filters.status);
        }

        if (filters.location) {
            whereClause.push(`c.location ILIKE $${++paramCount}`);
            params.push(`%${filters.location}%`);
        }

        if (filters.restaurant_id) {
            whereClause.push(`c.restaurant_id = $${++paramCount}`);
            params.push(filters.restaurant_id);
        }

        const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        
        const result = await query(`
            SELECT c.*, r.business_name, r.location as restaurant_location, r.profile_image as restaurant_image,
                   COUNT(a.id) as application_count
            FROM campaigns c 
            JOIN restaurants r ON c.restaurant_id = r.id 
            LEFT JOIN applications a ON c.id = a.campaign_id
            ${whereString}
            GROUP BY c.id, r.business_name, r.location, r.profile_image
            ORDER BY c.created_at DESC
        `, params);
        return result.rows;
    },

    async update(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        
        const result = await query(
            `UPDATE campaigns SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
            [...values, id]
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await query(
            'DELETE FROM campaigns WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

const Application = {
    async create({ campaign_id, influencer_id, message }) {
        const result = await query(
            'INSERT INTO applications (campaign_id, influencer_id, message) VALUES ($1, $2, $3) RETURNING *',
            [campaign_id, influencer_id, message]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await query(`
            SELECT a.*, c.title as campaign_title, i.display_name, i.instagram_handle, i.follower_count
            FROM applications a 
            JOIN campaigns c ON a.campaign_id = c.id 
            JOIN influencers i ON a.influencer_id = i.id 
            WHERE a.id = $1
        `, [id]);
        return result.rows[0];
    },

    async getByCampaign(campaign_id) {
        const result = await query(`
            SELECT a.*, i.display_name, i.instagram_handle, i.follower_count, i.profile_image, i.bio
            FROM applications a 
            JOIN influencers i ON a.influencer_id = i.id 
            WHERE a.campaign_id = $1 
            ORDER BY a.applied_at DESC
        `, [campaign_id]);
        return result.rows;
    },

    async getByInfluencer(influencer_id) {
        const result = await query(`
            SELECT a.*, c.title, c.description, c.budget_per_influencer, c.deadline, r.business_name
            FROM applications a 
            JOIN campaigns c ON a.campaign_id = c.id 
            JOIN restaurants r ON c.restaurant_id = r.id 
            WHERE a.influencer_id = $1 
            ORDER BY a.applied_at DESC
        `, [influencer_id]);
        return result.rows;
    },

    async updateStatus(id, status) {
        const result = await query(
            'UPDATE applications SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    },

    async checkExisting(campaign_id, influencer_id) {
        const result = await query(
            'SELECT * FROM applications WHERE campaign_id = $1 AND influencer_id = $2',
            [campaign_id, influencer_id]
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await query(
            'DELETE FROM applications WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

const Commission = {
    async create({ campaign_id, restaurant_id, influencer_id, campaign_amount, commission_rate }) {
        const commission_amount = (campaign_amount * commission_rate) / 100;
        const result = await query(
            `INSERT INTO commissions (campaign_id, restaurant_id, influencer_id, campaign_amount, commission_rate, commission_amount) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [campaign_id, restaurant_id, influencer_id, campaign_amount, commission_rate, commission_amount]
        );
        return result.rows[0];
    },

    async getAll(filters = {}) {
        let whereClause = [];
        let params = [];
        let paramCount = 0;

        if (filters.status) {
            whereClause.push(`co.status = $${++paramCount}`);
            params.push(filters.status);
        }

        if (filters.restaurant_id) {
            whereClause.push(`co.restaurant_id = $${++paramCount}`);
            params.push(filters.restaurant_id);
        }

        const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
        
        const result = await query(`
            SELECT co.*, c.title as campaign_title, r.business_name, i.display_name
            FROM commissions co
            JOIN campaigns c ON co.campaign_id = c.id
            JOIN restaurants r ON co.restaurant_id = r.id
            JOIN influencers i ON co.influencer_id = i.id
            ${whereString}
            ORDER BY co.created_at DESC
        `, params);
        return result.rows;
    },

    async updateStatus(id, status) {
        const result = await query(
            'UPDATE commissions SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    }
};

module.exports = {
    User,
    Restaurant,
    Influencer,
    Campaign,
    Application,
    Commission
};