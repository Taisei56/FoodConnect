const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class UserMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/users.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    async create({ email, password, userType, additionalData = {} }) {
        try {
            // Check if user already exists
            const existingUser = await this.findByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const client = await db.pool.connect();
                await client.query('BEGIN');
                
                // Hash password (8 rounds for MVP - faster while still secure)
                const passwordHash = await bcrypt.hash(password, 8);
                
                // Generate verification token
                const verificationToken = crypto.randomUUID();
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                
                // Insert user
                const userResult = await client.query(
                    `INSERT INTO users (email, password_hash, user_type, email_verification_token, email_verification_expires)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [email, passwordHash, userType, verificationToken, verificationExpires]
                );
                
                const user = userResult.rows[0];
                await client.query('COMMIT');
                client.release();
                
                return { user, verificationToken };
            } catch (dbError) {
                try {
                    const db = require('../config/database');
                    const client = await db.pool.connect();
                    await client.query('ROLLBACK');
                    client.release();
                } catch (rollbackError) {
                    // Ignore rollback errors for JSON fallback
                }
                
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
                
                // Hash password
                const passwordHash = await bcrypt.hash(password, 8);
                
                // Generate verification token
                const verificationToken = crypto.randomUUID();
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
                
                const user = {
                    id: newId,
                    email,
                    password_hash: passwordHash,
                    user_type: userType,
                    status: 'pending',
                    email_verified: false,
                    email_verification_token: verificationToken,
                    email_verification_expires: verificationExpires.toISOString(),
                    password_reset_token: null,
                    password_reset_expires: null,
                    last_login: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                users.push(user);
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                
                return { user, verificationToken };
            }
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    async findByEmail(email) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM users WHERE email = $1',
                    [email]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return users.find(u => u.email === email);
            }
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    async findById(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT * FROM users WHERE id = $1',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return users.find(u => u.id === parseInt(id));
            }
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }

    async findAll(filters = {}) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = 'SELECT * FROM users';
                const conditions = [];
                const values = [];
                
                if (filters.user_type) {
                    conditions.push(`user_type = $${values.length + 1}`);
                    values.push(filters.user_type);
                }
                
                if (filters.status) {
                    conditions.push(`status = $${values.length + 1}`);
                    values.push(filters.status);
                }
                
                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }
                
                query += ' ORDER BY created_at DESC';
                
                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                let filtered = users;
                
                if (filters.user_type) {
                    filtered = filtered.filter(u => u.user_type === filters.user_type);
                }
                
                if (filters.status) {
                    filtered = filtered.filter(u => u.status === filters.status);
                }
                
                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find users: ${error.message}`);
        }
    }

    async updateStatus(id, status) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                    [status, id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = users.findIndex(u => u.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('User not found');
                }
                
                users[index].status = status;
                users[index].updated_at = new Date().toISOString();
                
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                return users[index];
            }
        } catch (error) {
            throw new Error(`Failed to update user status: ${error.message}`);
        }
    }

    async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    async verifyEmail(token) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const client = await db.pool.connect();
                await client.query('BEGIN');
                
                const result = await client.query(
                    `UPDATE users 
                     SET email_verified = true, 
                         email_verification_token = NULL, 
                         email_verification_expires = NULL,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE email_verification_token = $1 
                     AND email_verification_expires > CURRENT_TIMESTAMP
                     RETURNING *`,
                    [token]
                );
                
                if (result.rows.length === 0) {
                    throw new Error('Invalid or expired verification token');
                }
                
                const user = result.rows[0];
                await client.query('COMMIT');
                client.release();
                return user;
            } catch (dbError) {
                try {
                    const db = require('../config/database');
                    const client = await db.pool.connect();
                    await client.query('ROLLBACK');
                    client.release();
                } catch (rollbackError) {
                    // Ignore rollback errors for JSON fallback
                }
                
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const now = new Date();
                
                const userIndex = users.findIndex(u => 
                    u.email_verification_token === token && 
                    new Date(u.email_verification_expires) > now
                );
                
                if (userIndex === -1) {
                    throw new Error('Invalid or expired verification token');
                }
                
                users[userIndex].email_verified = true;
                users[userIndex].email_verification_token = null;
                users[userIndex].email_verification_expires = null;
                users[userIndex].updated_at = new Date().toISOString();
                
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                return users[userIndex];
            }
        } catch (error) {
            throw error;
        }
    }

    generateJWT(user) {
        return jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                user_type: user.user_type,
                status: user.status
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
    }

    async authenticate(email, password) {
        try {
            const user = await this.findByEmail(email);
            if (!user) {
                throw new Error('Invalid email or password');
            }
            
            const isValidPassword = await this.verifyPassword(password, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Invalid email or password');
            }
            
            if (!user.email_verified) {
                throw new Error('Please verify your email before logging in');
            }

            if (user.status === 'suspended') {
                throw new Error('Your account has been suspended. Please contact support.');
            }
            
            // Update last login
            await this.updateLastLogin(user.id);
            
            return {
                id: user.id,
                email: user.email,
                user_type: user.user_type,
                status: user.status,
                email_verified: user.email_verified
            };
        } catch (error) {
            throw error;
        }
    }

    async updateLastLogin(userId) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                    [userId]
                );
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = users.findIndex(u => u.id === parseInt(userId));
                
                if (index !== -1) {
                    users[index].last_login = new Date().toISOString();
                    fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                }
            }
        } catch (error) {
            console.error('Failed to update last login:', error);
        }
    }

    async createPasswordResetToken(email) {
        try {
            const resetToken = crypto.randomUUID();
            const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `UPDATE users 
                     SET password_reset_token = $1, password_reset_expires = $2, updated_at = CURRENT_TIMESTAMP 
                     WHERE email = $3 
                     RETURNING *`,
                    [resetToken, resetExpires, email]
                );
                
                if (result.rows.length === 0) {
                    throw new Error('User not found');
                }
                
                return { user: result.rows[0], resetToken };
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const userIndex = users.findIndex(u => u.email === email);
                
                if (userIndex === -1) {
                    throw new Error('User not found');
                }
                
                users[userIndex].password_reset_token = resetToken;
                users[userIndex].password_reset_expires = resetExpires.toISOString();
                users[userIndex].updated_at = new Date().toISOString();
                
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                return { user: users[userIndex], resetToken };
            }
        } catch (error) {
            throw new Error(`Failed to create password reset token: ${error.message}`);
        }
    }

    async resetPassword(token, newPassword) {
        try {
            const passwordHash = await bcrypt.hash(newPassword, 8);

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `UPDATE users 
                     SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE password_reset_token = $2 AND password_reset_expires > CURRENT_TIMESTAMP
                     RETURNING *`,
                    [passwordHash, token]
                );
                
                if (result.rows.length === 0) {
                    throw new Error('Invalid or expired reset token');
                }
                
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const now = new Date();
                
                const userIndex = users.findIndex(u => 
                    u.password_reset_token === token && 
                    new Date(u.password_reset_expires) > now
                );
                
                if (userIndex === -1) {
                    throw new Error('Invalid or expired reset token');
                }
                
                users[userIndex].password_hash = passwordHash;
                users[userIndex].password_reset_token = null;
                users[userIndex].password_reset_expires = null;
                users[userIndex].updated_at = new Date().toISOString();
                
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                return users[userIndex];
            }
        } catch (error) {
            throw new Error(`Failed to reset password: ${error.message}`);
        }
    }

    // Get user statistics
    async getStats() {
        try {
            const users = await this.findAll();
            
            const stats = {
                total: users.length,
                by_type: {
                    restaurant: 0,
                    influencer: 0,
                    admin: 0
                },
                by_status: {
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    suspended: 0,
                    active: 0
                },
                email_verified: 0,
                recent_registrations: 0 // last 7 days
            };
            
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            users.forEach(user => {
                stats.by_type[user.user_type]++;
                stats.by_status[user.status]++;
                
                if (user.email_verified) {
                    stats.email_verified++;
                }
                
                if (new Date(user.created_at) > weekAgo) {
                    stats.recent_registrations++;
                }
            });
            
            return stats;
        } catch (error) {
            throw new Error(`Failed to get user stats: ${error.message}`);
        }
    }

    // Get user type labels
    static getUserTypeLabels() {
        return {
            'restaurant': 'Restaurant',
            'influencer': 'Influencer',
            'admin': 'Administrator'
        };
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'pending': 'Pending Approval',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'suspended': 'Suspended',
            'active': 'Active'
        };
    }

    // Get admin count
    async getAdminCount() {
        try {
            const users = await this.findAll({ user_type: 'admin' });
            return users.length;
        } catch (error) {
            console.error('Error getting admin count:', error);
            return 0;
        }
    }

    // Check if user has admin privileges
    async isAdmin(userId) {
        try {
            const user = await this.findById(userId);
            return user && user.user_type === 'admin' && user.status === 'active';
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    // Update user profile information
    async updateProfile(userId, profileData) {
        try {
            const user = await this.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [userId]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const users = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = users.findIndex(u => u.id === parseInt(userId));
                
                if (index === -1) {
                    throw new Error('User not found');
                }
                
                users[index].updated_at = new Date().toISOString();
                fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2));
                return users[index];
            }
        } catch (error) {
            throw new Error(`Failed to update user profile: ${error.message}`);
        }
    }
}

module.exports = UserMVP;