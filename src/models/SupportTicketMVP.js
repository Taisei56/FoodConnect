const fs = require('fs');
const path = require('path');

class SupportTicketMVP {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/mvp/support_tickets.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFile)) {
            fs.writeFileSync(this.dataFile, JSON.stringify([], null, 2));
        }
    }

    // Create support ticket
    async create(ticketData) {
        try {
            // Use PostgreSQL if available
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `INSERT INTO support_tickets (
                        user_id, subject, message, category, priority, status
                    ) VALUES ($1, $2, $3, $4, $5, 'open') RETURNING *`,
                    [
                        ticketData.user_id,
                        ticketData.subject,
                        ticketData.message,
                        ticketData.category || 'general',
                        ticketData.priority || 'normal'
                    ]
                );
                return result.rows[0];
            } catch (dbError) {
                // Fallback to JSON storage
                const tickets = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const newId = tickets.length > 0 ? Math.max(...tickets.map(t => t.id)) + 1 : 1;

                const ticket = {
                    id: newId,
                    user_id: ticketData.user_id,
                    subject: ticketData.subject,
                    message: ticketData.message,
                    category: ticketData.category || 'general',
                    priority: ticketData.priority || 'normal',
                    status: 'open',
                    assigned_to: null,
                    admin_response: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                tickets.push(ticket);
                fs.writeFileSync(this.dataFile, JSON.stringify(tickets, null, 2));
                return ticket;
            }
        } catch (error) {
            throw new Error(`Failed to create support ticket: ${error.message}`);
        }
    }

    // Find ticket by ID
    async findById(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    `SELECT st.*, u.email as user_email, u.user_type,
                            au.email as assigned_admin_email
                     FROM support_tickets st
                     JOIN users u ON st.user_id = u.id
                     LEFT JOIN users au ON st.assigned_to = au.id
                     WHERE st.id = $1`,
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const tickets = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                const ticket = tickets.find(t => t.id === parseInt(id));
                if (ticket) {
                    const user = users.find(u => u.id === ticket.user_id);
                    const assignedAdmin = ticket.assigned_to ? users.find(u => u.id === ticket.assigned_to) : null;

                    return {
                        ...ticket,
                        user_email: user?.email,
                        user_type: user?.user_type,
                        assigned_admin_email: assignedAdmin?.email
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Error finding ticket by ID:', error);
            return null;
        }
    }

    // Get all tickets with filters
    async findAll(filters = {}) {
        try {
            try {
                const db = require('../config/database');
                let query = `
                    SELECT st.*, u.email as user_email, u.user_type,
                           au.email as assigned_admin_email
                    FROM support_tickets st
                    JOIN users u ON st.user_id = u.id
                    LEFT JOIN users au ON st.assigned_to = au.id
                `;
                const conditions = [];
                const values = [];

                if (filters.status) {
                    conditions.push(`st.status = $${values.length + 1}`);
                    values.push(filters.status);
                }

                if (filters.category) {
                    conditions.push(`st.category = $${values.length + 1}`);
                    values.push(filters.category);
                }

                if (filters.priority) {
                    conditions.push(`st.priority = $${values.length + 1}`);
                    values.push(filters.priority);
                }

                if (filters.assigned_to) {
                    conditions.push(`st.assigned_to = $${values.length + 1}`);
                    values.push(filters.assigned_to);
                }

                if (filters.user_id) {
                    conditions.push(`st.user_id = $${values.length + 1}`);
                    values.push(filters.user_id);
                }

                if (filters.user_type) {
                    conditions.push(`u.user_type = $${values.length + 1}`);
                    values.push(filters.user_type);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY st.created_at DESC';

                const result = await db.query(query, values);
                return result.rows;
            } catch (dbError) {
                // Fallback to JSON storage
                const tickets = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const users = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/mvp/users.json'), 'utf8'));

                // Join with users data
                const ticketsWithUsers = tickets.map(ticket => {
                    const user = users.find(u => u.id === ticket.user_id);
                    const assignedAdmin = ticket.assigned_to ? users.find(u => u.id === ticket.assigned_to) : null;

                    return {
                        ...ticket,
                        user_email: user?.email,
                        user_type: user?.user_type,
                        assigned_admin_email: assignedAdmin?.email
                    };
                });

                let filtered = ticketsWithUsers;

                if (filters.status) {
                    filtered = filtered.filter(t => t.status === filters.status);
                }

                if (filters.category) {
                    filtered = filtered.filter(t => t.category === filters.category);
                }

                if (filters.priority) {
                    filtered = filtered.filter(t => t.priority === filters.priority);
                }

                if (filters.assigned_to) {
                    filtered = filtered.filter(t => t.assigned_to === parseInt(filters.assigned_to));
                }

                if (filters.user_id) {
                    filtered = filtered.filter(t => t.user_id === parseInt(filters.user_id));
                }

                if (filters.user_type) {
                    filtered = filtered.filter(t => t.user_type === filters.user_type);
                }

                return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } catch (error) {
            throw new Error(`Failed to find support tickets: ${error.message}`);
        }
    }

    // Update ticket
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
                    `UPDATE support_tickets SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $${values.length} RETURNING *`,
                    values
                );

                return result.rows[0];
            } catch (dbError) {
                const tickets = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = tickets.findIndex(t => t.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Support ticket not found');
                }

                Object.keys(updateData).forEach(key => {
                    if (updateData[key] !== undefined && key !== 'id') {
                        tickets[index][key] = updateData[key];
                    }
                });

                tickets[index].updated_at = new Date().toISOString();

                fs.writeFileSync(this.dataFile, JSON.stringify(tickets, null, 2));
                return tickets[index];
            }
        } catch (error) {
            throw new Error(`Failed to update support ticket: ${error.message}`);
        }
    }

    // Assign ticket to admin
    async assignToAdmin(ticketId, adminId) {
        try {
            return await this.update(ticketId, {
                assigned_to: adminId,
                status: 'in_progress'
            });
        } catch (error) {
            throw new Error(`Failed to assign ticket: ${error.message}`);
        }
    }

    // Add admin response
    async addResponse(ticketId, response, status = 'in_progress') {
        try {
            return await this.update(ticketId, {
                admin_response: response,
                status: status
            });
        } catch (error) {
            throw new Error(`Failed to add response: ${error.message}`);
        }
    }

    // Close ticket
    async closeTicket(ticketId, response = null) {
        try {
            const updateData = { status: 'closed' };
            if (response) {
                updateData.admin_response = response;
            }
            return await this.update(ticketId, updateData);
        } catch (error) {
            throw new Error(`Failed to close ticket: ${error.message}`);
        }
    }

    // Reopen ticket
    async reopenTicket(ticketId) {
        try {
            return await this.update(ticketId, { status: 'open' });
        } catch (error) {
            throw new Error(`Failed to reopen ticket: ${error.message}`);
        }
    }

    // Get tickets by user
    async getByUser(userId) {
        return await this.findAll({ user_id: userId });
    }

    // Get assigned tickets for admin
    async getAssignedTickets(adminId) {
        return await this.findAll({ assigned_to: adminId });
    }

    // Get open tickets
    async getOpenTickets() {
        return await this.findAll({ status: 'open' });
    }

    // Get tickets in progress
    async getInProgressTickets() {
        return await this.findAll({ status: 'in_progress' });
    }

    // Get ticket statistics
    async getStats(filters = {}) {
        try {
            const tickets = await this.findAll(filters);

            const stats = {
                total: tickets.length,
                by_status: {
                    open: 0,
                    in_progress: 0,
                    resolved: 0,
                    closed: 0
                },
                by_priority: {
                    low: 0,
                    normal: 0,
                    high: 0,
                    urgent: 0
                },
                by_category: {},
                recent_tickets: 0, // last 7 days
                average_response_time: 0,
                unassigned_tickets: 0
            };

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            tickets.forEach(ticket => {
                if (ticket.status) {
                    stats.by_status[ticket.status]++;
                }

                if (ticket.priority) {
                    stats.by_priority[ticket.priority]++;
                }

                if (ticket.category) {
                    stats.by_category[ticket.category] = (stats.by_category[ticket.category] || 0) + 1;
                }

                if (new Date(ticket.created_at) > weekAgo) {
                    stats.recent_tickets++;
                }

                if (!ticket.assigned_to) {
                    stats.unassigned_tickets++;
                }
            });

            return stats;
        } catch (error) {
            throw new Error(`Failed to get support ticket stats: ${error.message}`);
        }
    }

    // Search tickets
    async search(searchTerm, filters = {}) {
        try {
            const allTickets = await this.findAll(filters);

            if (!searchTerm) {
                return allTickets;
            }

            const lowerSearchTerm = searchTerm.toLowerCase();

            return allTickets.filter(ticket =>
                (ticket.subject && ticket.subject.toLowerCase().includes(lowerSearchTerm)) ||
                (ticket.message && ticket.message.toLowerCase().includes(lowerSearchTerm)) ||
                (ticket.admin_response && ticket.admin_response.toLowerCase().includes(lowerSearchTerm)) ||
                (ticket.user_email && ticket.user_email.toLowerCase().includes(lowerSearchTerm))
            );
        } catch (error) {
            throw new Error(`Failed to search tickets: ${error.message}`);
        }
    }

    // Get status labels
    static getStatusLabels() {
        return {
            'open': 'Open',
            'in_progress': 'In Progress',
            'resolved': 'Resolved',
            'closed': 'Closed'
        };
    }

    // Get priority labels
    static getPriorityLabels() {
        return {
            'low': 'Low Priority',
            'normal': 'Normal Priority',
            'high': 'High Priority',
            'urgent': 'Urgent'
        };
    }

    // Get category labels
    static getCategoryLabels() {
        return {
            'general': 'General Inquiry',
            'technical': 'Technical Issue',
            'billing': 'Billing/Payment',
            'account': 'Account Issue',
            'campaign': 'Campaign Related',
            'content': 'Content Issue',
            'suggestion': 'Feature Request/Suggestion',
            'report': 'Report Issue/User'
        };
    }

    // Get priority colors for UI
    static getPriorityColors() {
        return {
            'low': '#28a745',
            'normal': '#17a2b8',
            'high': '#ffc107',
            'urgent': '#dc3545'
        };
    }

    // Get status colors for UI
    static getStatusColors() {
        return {
            'open': '#dc3545',
            'in_progress': '#ffc107',
            'resolved': '#28a745',
            'closed': '#6c757d'
        };
    }

    // Delete ticket (admin only)
    async delete(id) {
        try {
            try {
                const db = require('../config/database');
                const result = await db.query(
                    'DELETE FROM support_tickets WHERE id = $1 RETURNING *',
                    [id]
                );
                return result.rows[0];
            } catch (dbError) {
                const tickets = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                const index = tickets.findIndex(t => t.id === parseInt(id));

                if (index === -1) {
                    throw new Error('Support ticket not found');
                }

                const deleted = tickets.splice(index, 1)[0];
                fs.writeFileSync(this.dataFile, JSON.stringify(tickets, null, 2));
                return deleted;
            }
        } catch (error) {
            throw new Error(`Failed to delete support ticket: ${error.message}`);
        }
    }

    // Get ticket priorities sorted by urgency
    static getPriorityOrder() {
        return ['urgent', 'high', 'normal', 'low'];
    }

    // Check if ticket can be modified by user
    canUserModify(ticket, userId, userType) {
        // User can modify their own tickets if not closed
        if (ticket.user_id === userId && ticket.status !== 'closed') {
            return true;
        }
        // Admin can modify any ticket
        if (userType === 'admin') {
            return true;
        }
        return false;
    }

    // Get escalation suggestions
    getEscalationSuggestions(ticket) {
        const suggestions = [];
        const createdAt = new Date(ticket.created_at);
        const now = new Date();
        const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);

        if (ticket.priority === 'urgent' && hoursSinceCreated > 1) {
            suggestions.push('Urgent ticket requires immediate attention');
        } else if (ticket.priority === 'high' && hoursSinceCreated > 4) {
            suggestions.push('High priority ticket needs response');
        } else if (ticket.priority === 'normal' && hoursSinceCreated > 24) {
            suggestions.push('Normal priority ticket pending for over 24 hours');
        }

        if (ticket.status === 'open' && hoursSinceCreated > 48) {
            suggestions.push('Unassigned ticket for over 48 hours');
        }

        return suggestions;
    }
}

module.exports = SupportTicketMVP;