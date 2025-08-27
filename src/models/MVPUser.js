// MVP User model that works without a database
// Uses persistent file storage for data across server restarts

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const persistentDb = require('../config/persistent-db');

class MVPUser {
    static async create({ email, password, userType, additionalData = {} }) {
        try {
            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);
            
            // Generate verification token
            const verificationToken = crypto.randomUUID();
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Insert user using persistent storage
            const userResult = await persistentDb.query(
                `INSERT INTO users (email, password_hash, user_type, email_verification_token, email_verification_expires)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [email, passwordHash, userType, verificationToken, verificationExpires]
            );
            
            const user = userResult.rows[0];
            
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    userType: user.user_type,
                    status: user.status,
                    emailVerified: user.email_verified,
                    createdAt: user.created_at
                },
                profile: additionalData, // Store additional data in the response for MVP
                verificationToken
            };
            
        } catch (error) {
            console.error('MVP User creation error:', error);
            throw error;
        }
    }
    
    static async findByEmail(email) {
        const result = await persistentDb.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }
    
    static async findById(id) {
        const result = await persistentDb.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
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
        
        // For MVP, allow login even without email verification
        // Comment out the email verification check for MVP mode
        // if (!user.email_verified) {
        //     throw new Error('Email not verified');
        // }
        
        return {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            status: user.status,
            emailVerified: user.email_verified
        };
    }
    
    static async verifyEmail(token) {
        try {
            // Find user by verification token
            const users = persistentDb._getCache().users;
            const user = users.find(u => u.email_verification_token === token && 
                                        new Date(u.email_verification_expires) > new Date());
            
            if (!user) {
                throw new Error('Invalid or expired verification token');
            }
            
            // Update user as verified
            await persistentDb.query(
                'UPDATE users SET email_verified = TRUE WHERE id = $1',
                [user.id]
            );
            
            // Return updated user
            return await this.findById(user.id);
            
        } catch (error) {
            console.error('MVP Email verification error:', error);
            throw error;
        }
    }
    
    static async getUserWithProfile(userId) {
        const user = await this.findById(userId);
        if (!user) return null;
        
        return {
            user: {
                id: user.id,
                email: user.email,
                userType: user.user_type,
                status: user.status,
                emailVerified: user.email_verified,
                createdAt: user.created_at
            },
            profile: null // MVP mode doesn't have separate profile tables
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
        
        // For MVP, just return the token without updating (email service may not work)
        return verificationToken;
    }
}

module.exports = MVPUser;