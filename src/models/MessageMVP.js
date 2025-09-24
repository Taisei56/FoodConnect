const fs = require('fs');
const path = require('path');

class MessageMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/messages.json');
        this.conversationsFile = path.join(__dirname, '../../data/mvp/conversations.json');
        this.ensureDataFiles();
    }

    ensureDataFiles() {
        const files = [this.dataFile, this.conversationsFile];
        files.forEach(file => {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify([], null, 2));
            }
        });
    }

    // Send message
    async sendMessage(messageData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO messages (
                        sender_id, receiver_id, campaign_id, application_id,
                        message, attachment_url, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'sent') RETURNING *`,
                    [
                        messageData.sender_id,
                        messageData.receiver_id,
                        messageData.campaign_id || null,
                        messageData.application_id || null,
                        messageData.message,
                        messageData.attachment_url || null
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1;

                const message = {
                    id: newId,
                    sender_id: messageData.sender_id,
                    receiver_id: messageData.receiver_id,
                    campaign_id: messageData.campaign_id || null,
                    application_id: messageData.application_id || null,
                    message: messageData.message,
                    attachment_url: messageData.attachment_url || null,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    read_at: null
                };

                messages.push(message);
                fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));

                // Update or create conversation
                await this.updateConversation(messageData.sender_id, messageData.receiver_id, message);

                return message;
            }
        } catch (error) {
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    // Get conversation between two users
    async getConversation(userId1, userId2, campaignId = null) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT m.*,
                           s.email as sender_email, s.user_type as sender_type,
                           r.email as receiver_email, r.user_type as receiver_type
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR
                           (m.sender_id = $2 AND m.receiver_id = $1))
                `;
                const values = [userId1, userId2];

                if (campaignId) {
                    query += ` AND m.campaign_id = $3`;
                    values.push(campaignId);
                }

                query += ` ORDER BY m.sent_at ASC`;

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                let conversation = messages.filter(msg =>
                    ((msg.sender_id === parseInt(userId1) && msg.receiver_id === parseInt(userId2)) ||
                     (msg.sender_id === parseInt(userId2) && msg.receiver_id === parseInt(userId1)))
                );

                if (campaignId) {
                    conversation = conversation.filter(msg => msg.campaign_id === parseInt(campaignId));
                }

                // Add user details
                const conversationWithUsers = conversation.map(msg => {
                    const sender = users.find(u => u.id === msg.sender_id);
                    const receiver = users.find(u => u.id === msg.receiver_id);
                    return {
                        ...msg,
                        sender_email: sender?.email,
                        sender_type: sender?.user_type,
                        receiver_email: receiver?.email,
                        receiver_type: receiver?.user_type
                    };
                });

                return conversationWithUsers.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
            }
        } catch (error) {
            throw new Error(`Failed to get conversation: ${error.message}`);
        }
    }

    // Get all conversations for a user
    async getUserConversations(userId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(`
                    SELECT DISTINCT
                        CASE
                            WHEN m.sender_id = $1 THEN m.receiver_id
                            ELSE m.sender_id
                        END as other_user_id,
                        CASE
                            WHEN m.sender_id = $1 THEN r.email
                            ELSE s.email
                        END as other_user_email,
                        CASE
                            WHEN m.sender_id = $1 THEN r.user_type
                            ELSE s.user_type
                        END as other_user_type,
                        m.campaign_id,
                        c.title as campaign_title,
                        MAX(m.sent_at) as last_message_at,
                        COUNT(CASE WHEN m.receiver_id = $1 AND m.read_at IS NULL THEN 1 END) as unread_count
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    LEFT JOIN campaigns c ON m.campaign_id = c.id
                    WHERE m.sender_id = $1 OR m.receiver_id = $1
                    GROUP BY other_user_id, other_user_email, other_user_type, m.campaign_id, c.title
                    ORDER BY last_message_at DESC
                `, [userId]);

                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));

                const userMessages = messages.filter(msg =>
                    msg.sender_id === parseInt(userId) || msg.receiver_id === parseInt(userId)
                );

                const conversationMap = new Map();

                userMessages.forEach(msg => {
                    const otherUserId = msg.sender_id === parseInt(userId) ? msg.receiver_id : msg.sender_id;
                    const key = `${otherUserId}-${msg.campaign_id || 'general'}`;

                    if (!conversationMap.has(key)) {
                        const otherUser = users.find(u => u.id === otherUserId);
                        const campaign = msg.campaign_id ? campaigns.find(c => c.id === msg.campaign_id) : null;

                        conversationMap.set(key, {
                            other_user_id: otherUserId,
                            other_user_email: otherUser?.email,
                            other_user_type: otherUser?.user_type,
                            campaign_id: msg.campaign_id,
                            campaign_title: campaign?.title,
                            last_message_at: msg.sent_at,
                            unread_count: 0
                        });
                    } else {
                        const conversation = conversationMap.get(key);
                        if (new Date(msg.sent_at) > new Date(conversation.last_message_at)) {
                            conversation.last_message_at = msg.sent_at;
                        }
                    }

                    // Count unread messages
                    if (msg.receiver_id === parseInt(userId) && !msg.read_at) {
                        const conversation = conversationMap.get(key);
                        conversation.unread_count++;
                    }
                });

                return Array.from(conversationMap.values())
                    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            }
        } catch (error) {
            throw new Error(`Failed to get user conversations: ${error.message}`);
        }
    }

    // Mark messages as read
    async markAsRead(userId, otherUserId, campaignId = null) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    UPDATE messages
                    SET read_at = CURRENT_TIMESTAMP, status = 'read'
                    WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL
                `;
                const values = [userId, otherUserId];

                if (campaignId) {
                    query += ` AND campaign_id = $3`;
                    values.push(campaignId);
                }

                const result = await db.query(query, values);
                return result.rowCount;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                let updatedCount = 0;

                messages.forEach(msg => {
                    if (msg.receiver_id === parseInt(userId) &&
                        msg.sender_id === parseInt(otherUserId) &&
                        !msg.read_at &&
                        (!campaignId || msg.campaign_id === parseInt(campaignId))) {
                        msg.read_at = new Date().toISOString();
                        msg.status = 'read';
                        updatedCount++;
                    }
                });

                if (updatedCount > 0) {
                    fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));
                }

                return updatedCount;
            }
        } catch (error) {
            throw new Error(`Failed to mark messages as read: ${error.message}`);
        }
    }

    // Get unread message count for user
    async getUnreadCount(userId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND read_at IS NULL',
                    [userId]
                );
                return parseInt(result.rows[0].count);
            } catch (dbError) {
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                return messages.filter(msg =>
                    msg.receiver_id === parseInt(userId) && !msg.read_at
                ).length;
            }
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    // Update conversation metadata (for JSON storage)
    async updateConversation(userId1, userId2, lastMessage) {
        try {
            const conversations = JSON.parse(fs.readFileSync(this.conversationsFile, 'utf8'));
            const conversationKey = [userId1, userId2].sort().join('-');

            const existingIndex = conversations.findIndex(conv => conv.key === conversationKey);

            const conversationData = {
                key: conversationKey,
                participants: [userId1, userId2],
                last_message_id: lastMessage.id,
                last_message_at: lastMessage.sent_at,
                updated_at: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                conversations[existingIndex] = conversationData;
            } else {
                conversations.push(conversationData);
            }

            fs.writeFileSync(this.conversationsFile, JSON.stringify(conversations, null, 2));
        } catch (error) {
            console.error('Error updating conversation:', error);
        }
    }

    // Search messages
    async searchMessages(userId, searchTerm) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(`
                    SELECT m.*,
                           s.email as sender_email, s.user_type as sender_type,
                           r.email as receiver_email, r.user_type as receiver_type,
                           c.title as campaign_title
                    FROM messages m
                    JOIN users s ON m.sender_id = s.id
                    JOIN users r ON m.receiver_id = r.id
                    LEFT JOIN campaigns c ON m.campaign_id = c.id
                    WHERE (m.sender_id = $1 OR m.receiver_id = $1)
                    AND m.message ILIKE $2
                    ORDER BY m.sent_at DESC
                    LIMIT 50
                `, [userId, `%${searchTerm}%`]);

                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));
                const campaigns = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/campaigns.json'), 'utf8'));

                const userMessages = messages.filter(msg =>
                    (msg.sender_id === parseInt(userId) || msg.receiver_id === parseInt(userId)) &&
                    msg.message.toLowerCase().includes(searchTerm.toLowerCase())
                );

                const messagesWithDetails = userMessages.map(msg => {
                    const sender = users.find(u => u.id === msg.sender_id);
                    const receiver = users.find(u => u.id === msg.receiver_id);
                    const campaign = msg.campaign_id ? campaigns.find(c => c.id === msg.campaign_id) : null;

                    return {
                        ...msg,
                        sender_email: sender?.email,
                        sender_type: sender?.user_type,
                        receiver_email: receiver?.email,
                        receiver_type: receiver?.user_type,
                        campaign_title: campaign?.title
                    };
                });

                return messagesWithDetails
                    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))
                    .slice(0, 50);
            }
        } catch (error) {
            throw new Error(`Failed to search messages: ${error.message}`);
        }
    }

    // Delete message
    async deleteMessage(messageId, userId) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING *',
                    [messageId, userId]
                );
                return result.rows[0];
            } catch (dbError) {
                const messages = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const messageIndex = messages.findIndex(msg =>
                    msg.id === parseInt(messageId) && msg.sender_id === parseInt(userId)
                );

                if (messageIndex === -1) {
                    throw new Error('Message not found or unauthorized');
                }

                const deletedMessage = messages.splice(messageIndex, 1)[0];
                fs.writeFileSync(this.dataFile, JSON.stringify(messages, null, 2));
                return deletedMessage;
            }
        } catch (error) {
            throw new Error(`Failed to delete message: ${error.message}`);
        }
    }

    // Get message statistics
    async getMessageStats(userId) {
        try {
            const messages = await this.getUserConversations(userId);
            const unreadCount = await this.getUnreadCount(userId);

            return {
                total_conversations: messages.length,
                unread_messages: unreadCount,
                active_conversations: messages.filter(conv => {
                    const lastMessageDate = new Date(conv.last_message_at);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return lastMessageDate > weekAgo;
                }).length
            };
        } catch (error) {
            throw new Error(`Failed to get message stats: ${error.message}`);
        }
    }
}

module.exports = MessageMVP;