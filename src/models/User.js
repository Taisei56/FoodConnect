const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class User {
    static async create({ email, password, userType, additionalData = {} }) {
        const client = await db.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);
            
            // Generate verification token
            const verificationToken = crypto.randomUUID();
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Insert user
            const userResult = await client.query(
                `INSERT INTO users (email, password_hash, user_type, email_verification_token, email_verification_expires, verification_sent_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [email, passwordHash, userType, verificationToken, verificationExpires]
            );
            
            const user = userResult.rows[0];
            
            // Create profile based on user type
            let profile = null;
            if (userType === 'restaurant') {
                const restaurantResult = await client.query(
                    `INSERT INTO restaurants (user_id, business_name, location, cuisine_type, phone, description)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [
                        user.id,
                        additionalData.businessName || '',
                        additionalData.location || '',
                        additionalData.cuisineType || '',
                        additionalData.phone || '',
                        additionalData.description || ''
                    ]
                );
                profile = restaurantResult.rows[0];
            } else if (userType === 'influencer') {
                const influencerResult = await client.query(
                    `INSERT INTO influencers (user_id, display_name, instagram_handle, follower_count, location, bio)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [
                        user.id,
                        additionalData.displayName || '',
                        additionalData.instagramHandle || '',
                        additionalData.followerCount || 0,
                        additionalData.location || '',
                        additionalData.bio || ''
                    ]
                );
                profile = influencerResult.rows[0];
            }
            
            // Insert email verification record
            await client.query(
                `INSERT INTO email_verifications (user_id, email, token, expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, email, verificationToken, verificationExpires]
            );
            
            await client.query('COMMIT');
            
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    userType: user.user_type,
                    status: user.status,
                    emailVerified: user.email_verified,
                    createdAt: user.created_at
                },
                profile,
                verificationToken
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    static async findByEmail(email) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }
    
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }
    
    static async verifyEmail(token) {
        const client = await db.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Find verification record
            const verificationResult = await client.query(
                `SELECT * FROM email_verifications 
                 WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND verified_at IS NULL`,
                [token]
            );
            
            if (verificationResult.rows.length === 0) {
                throw new Error('Invalid or expired verification token');
            }
            
            const verification = verificationResult.rows[0];
            
            // Update user as verified
            await client.query(
                'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
                [verification.user_id]
            );
            
            // Mark verification as completed
            await client.query(
                'UPDATE email_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1',
                [verification.id]
            );
            
            await client.query('COMMIT');
            
            // Return updated user
            const userResult = await client.query('SELECT * FROM users WHERE id = $1', [verification.user_id]);
            return userResult.rows[0];
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    static async authenticate(email, password) {
        const user = await this.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }
        
        if (!user.email_verified) {
            throw new Error('Email not verified');
        }
        
        return {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            status: user.status,
            emailVerified: user.email_verified
        };
    }
    
    static async getUserWithProfile(userId) {
        const user = await this.findById(userId);
        if (!user) return null;
        
        let profile = null;
        if (user.user_type === 'restaurant') {
            const profileResult = await db.query(
                'SELECT * FROM restaurants WHERE user_id = $1',
                [userId]
            );
            profile = profileResult.rows[0];
        } else if (user.user_type === 'influencer') {
            const profileResult = await db.query(
                'SELECT * FROM influencers WHERE user_id = $1',
                [userId]
            );
            profile = profileResult.rows[0];
        }
        
        return {
            user: {
                id: user.id,
                email: user.email,
                userType: user.user_type,
                status: user.status,
                emailVerified: user.email_verified,
                createdAt: user.created_at
            },
            profile
        };
    }
    
    static async resendVerificationEmail(email) {
        const user = await this.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        
        if (user.email_verified) {
            throw new Error('Email already verified');
        }
        
        // Generate new verification token
        const verificationToken = crypto.randomUUID();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const client = await db.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Update user with new token
            await client.query(
                `UPDATE users 
                 SET email_verification_token = $1, email_verification_expires = $2, verification_sent_at = CURRENT_TIMESTAMP 
                 WHERE id = $3`,
                [verificationToken, verificationExpires, user.id]
            );
            
            // Insert new verification record
            await client.query(
                `INSERT INTO email_verifications (user_id, email, token, expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, email, verificationToken, verificationExpires]
            );
            
            await client.query('COMMIT');
            
            return verificationToken;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = User;