const fs = require('fs');
const path = require('path');

class Message {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/messages.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    async create(messageData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO messages (
                        sender_id, receiver_id, campaign_id, application_id, 
                        message, attachment_url, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    RETURNING *`,
                    [
                        messageData.sender_id,
                        messageData.receiver_id,
                        messageData.campaign_id || null,
                        messageData.application_id || null,
                        messageData.message,
                        messageData.attachment_url || null,
                        messageData.status || 'sent'
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;
                
                const message = {
                    id: newId,
                    ...messageData,
                    status: messageData.status || 'sent',
                    sent_at: new Date().toISOString()
                };
                
                messages.push(message);
                fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));
                return message;
            }
        } catch (error) {
            throw new Error(`Failed to create message: ${error.message}`);
        }
    }

    async findById(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT m.*, 
                            s.email as sender_email, s.user_type as sender_type,
                            r.email as receiver_email, r.user_type as receiver_type
                     FROM messages m
                     JOIN users s ON m.sender_id = s.id
                     JOIN users r ON m.receiver_id = r.id
                     WHERE m.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const message = messages.find(m => m.id === parseInt(id));
                
                if (message) {
                    // Enrich with user data
                    const usersFile = path.join(__dirname, '../../data/mvp/users.json');
                    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
                    
                    const sender = users.find(u => u.id === message.sender_id);
                    const receiver = users.find(u => u.id === message.receiver_id);
                    
                    return {
                        ...message,
                        sender_email: sender?.email,
                        sender_type: sender?.user_type,
                        receiver_email: receiver?.email,
                        receiver_type: receiver?.user_type
                    };
                }
                
                return message;
            }
        } catch (error) {
            throw new Error(`Failed to find message: ${error.message}`);
        }
    }

    async findConversation(user1Id, user2Id, campaignId = null) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    SELECT m.*, 
                           s.email as sender_email, s.user_type as sender_type,
                           r.email as receiver_email, r.user_type as receiver_type
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    WHERE ((m.sender_id = $1 AND m.receiver_id = $2) 
                           OR (m.sender_id = $2 AND m.receiver_id = $1))
                `;
                
                const params = [user1Id, user2Id];
                
                if (campaignId) {
                    query += ' AND m.campaign_id = $3';
                    params.push(campaignId);
                }
                
                query += ' ORDER BY m.sent_at ASC';
                
                const result = await db.query(query, params);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const usersFile = path.join(__dirname, '../../data/mvp/users.json');
                const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
                
                let filtered = messages.filter(m => 
                    ((m.sender_id === parseInt(user1Id) && m.receiver_id === parseInt(user2Id)) ||
                     (m.sender_id === parseInt(user2Id) && m.receiver_id === parseInt(user1Id)))
                );
                
                if (campaignId) {
                    filtered = filtered.filter(m => m.campaign_id === parseInt(campaignId));
                }
                
                // Enrich with user data
                const enriched = filtered.map(message => {
                    const sender = users.find(u => u.id === message.sender_id);
                    const receiver = users.find(u => u.id === message.receiver_id);
                    
                    return {
                        ...message,
                        sender_email: sender?.email,
                        sender_type: sender?.user_type,
                        receiver_email: receiver?.email,
                        receiver_type: receiver?.user_type
                    };
                });
                
                return enriched.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
            }
        } catch (error) {
            throw new Error(`Failed to find conversation: ${error.message}`);
        }
    }

    async findByUser(userId, limit = 50) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT m.*, 
                            s.email as sender_email, s.user_type as sender_type,
                            r.email as receiver_email, r.user_type as receiver_type,
                            c.title as campaign_title
                     FROM messages m
                     JOIN users s ON m.sender_id = s.id
                     JOIN users r ON m.receiver_id = r.id
                     LEFT JOIN campaigns c ON m.campaign_id = c.id
                     WHERE m.sender_id = $1 OR m.receiver_id = $1
                     ORDER BY m.sent_at DESC
                     LIMIT $2`,
                    [userId, limit]
                );
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const usersFile = path.join(__dirname, '../../data/mvp/users.json');
                const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
                
                let filtered = messages.filter(m => 
                    m.sender_id === parseInt(userId) || m.receiver_id === parseInt(userId)
                );
                
                // Enrich with user data
                const enriched = filtered.map(message => {
                    const sender = users.find(u => u.id === message.sender_id);
                    const receiver = users.find(u => u.id === message.receiver_id);
                    
                    return {
                        ...message,
                        sender_email: sender?.email,
                        sender_type: sender?.user_type,
                        receiver_email: receiver?.email,
                        receiver_type: receiver?.user_type
                    };
                });
                
                return enriched
                    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))
                    .slice(0, limit);
            }
        } catch (error) {
            throw new Error(`Failed to find messages by user: ${error.message}`);
        }
    }

    async getConversationList(userId) {
        try {
            // Get unique conversations for a user
            const messages = await this.findByUser(userId, 1000);
            
            const conversationsMap = new Map();
            
            messages.forEach(message => {
                const otherUserId = message.sender_id === parseInt(userId) ? 
                    message.receiver_id : message.sender_id;
                
                const conversationKey = `${Math.min(parseInt(userId), otherUserId)}_${Math.max(parseInt(userId), otherUserId)}`;
                
                if (!conversationsMap.has(conversationKey) || 
                    new Date(message.sent_at) > new Date(conversationsMap.get(conversationKey).last_message_at)) {
                    
                    conversationsMap.set(conversationKey, {
                        other_user_id: otherUserId,
                        other_user_email: message.sender_id === parseInt(userId) ? 
                            message.receiver_email : message.sender_email,
                        other_user_type: message.sender_id === parseInt(userId) ? 
                            message.receiver_type : message.sender_type,
                        last_message: message.message,
                        last_message_at: message.sent_at,
                        campaign_id: message.campaign_id,
                        campaign_title: message.campaign_title,
                        unread: message.receiver_id === parseInt(userId) && !message.read_at
                    });
                }
            });
            
            return Array.from(conversationsMap.values())
                .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        } catch (error) {
            throw new Error(`Failed to get conversation list: ${error.message}`);
        }
    }

    async markAsRead(id, readAt = null) {
        try {
            const updates = {
                status: 'read',
                read_at: readAt || new Date().toISOString()
            };

            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'UPDATE messages SET status = $1, read_at = $2 WHERE id = $3 RETURNING *',
                    [updates.status, updates.read_at, id]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = messages.findIndex(m => m.id === parseInt(id));
                
                if (index === -1) {
                    throw new Error('Message not found');
                }
                
                messages[index] = {
                    ...messages[index],
                    ...updates
                };
                
                fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));
                return messages[index];
            }
        } catch (error) {
            throw new Error(`Failed to mark message as read: ${error.message}`);
        }
    }

    async markConversationAsRead(userId, otherUserId, campaignId = null) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                let query = `
                    UPDATE messages 
                    SET status = 'read', read_at = CURRENT_TIMESTAMP 
                    WHERE receiver_id = $1 AND sender_id = $2 AND status != 'read'
                `;
                const params = [userId, otherUserId];
                
                if (campaignId) {
                    query += ' AND campaign_id = $3';
                    params.push(campaignId);
                }
                
                await db.query(query, params);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                let updated = false;
                
                messages.forEach(message => {
                    if (message.receiver_id === parseInt(userId) && 
                        message.sender_id === parseInt(otherUserId) &&
                        message.status !== 'read') {
                        
                        if (!campaignId || message.campaign_id === parseInt(campaignId)) {
                            message.status = 'read';
                            message.read_at = new Date().toISOString();
                            updated = true;
                        }
                    }
                });
                
                if (updated) {
                    fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));
                }
                
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to mark conversation as read: ${error.message}`);
        }
    }

    async getUnreadCount(userId) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND status != $2',
                    [userId, 'read']
                );
                return parseInt(result.rows[0].count);
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return messages.filter(m => 
                    m.receiver_id === parseInt(userId) && m.status !== 'read'
                ).length;
            }
        } catch (error) {
            throw new Error(`Failed to get unread count: ${error.message}`);
        }
    }

    async delete(id) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                await db.query('DELETE FROM messages WHERE id = $1', [id]);
                return true;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const filtered = messages.filter(m => m.id !== parseInt(id));
                fs.writeFileSync(this.dataFile, JSON.stringify(filtered, null, 2));
                return true;
            }
        } catch (error) {
            throw new Error(`Failed to delete message: ${error.message}`);
        }
    }

    // Get message statistics
    async getStats(userId = null) {
        try {
            let messages = [];
            
            if (userId) {
                messages = await this.findByUser(userId, 10000);
            } else {
                messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
            }
            
            const stats = {
                total: messages.length,
                by_status: {
                    sent: 0,
                    delivered: 0,
                    read: 0
                },
                unread: 0
            };
            
            messages.forEach(msg => {
                stats.by_status[msg.status]++;
                if (userId && msg.receiver_id === parseInt(userId) && msg.status !== 'read') {
                    stats.unread++;
                }
            });
            
            return stats;
        } catch (error) {
            throw new Error(`Failed to get message stats: ${error.message}`);
        }
    }

    // Send system message (from admin)
    async sendSystemMessage(receiverId, message, campaignId = null) {
        try {
            // Get admin user ID
            const usersFile = path.join(__dirname, '../../data/mvp/users.json');
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            const admin = users.find(u => u.user_type === 'admin');
            
            if (!admin) {
                throw new Error('Admin user not found');
            }
            
            return this.create({
                sender_id: admin.id,
                receiver_id: receiverId,
                campaign_id: campaignId,
                message: `[SYSTEM] ${message}`,
                status: 'sent'
            });
        } catch (error) {
            throw new Error(`Failed to send system message: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'sent': 'Sent',
            'delivered': 'Delivered',
            'read': 'Read'
        };
    }
}

module.exports = Message;