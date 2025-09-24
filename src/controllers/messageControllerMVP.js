const MessageMVP = require('../models/MessageMVP');
const UserMVP = require('../models/UserMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const CampaignMVP = require('../models/CampaignMVP');
const { body, validationResult } = require('express-validator');

class MessageControllerMVP {
    // Message validation
    static getMessageValidation() {
        return [
            body('message')
                .trim()
                .isLength({ min: 1, max: 2000 })
                .withMessage('Message must be between 1 and 2000 characters'),
            body('receiver_id')
                .isInt({ min: 1 })
                .withMessage('Valid receiver ID is required')
        ];
    }

    // Send message
    static async sendMessage(req, res) {
        try {
            console.log('🔄 Sending message');

            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { message, receiver_id, campaign_id, application_id, attachment_url } = req.body;
            const senderId = req.user.id;

            // Verify receiver exists
            const userModel = new UserMVP();
            const receiver = await userModel.findById(receiver_id);

            if (!receiver) {
                return res.status(404).json({
                    success: false,
                    error: 'Receiver not found'
                });
            }

            // Check if sender can message receiver (basic authorization)
            const canMessage = await MessageControllerMVP.canUsersMessage(senderId, receiver_id, campaign_id);
            if (!canMessage) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not authorized to message this user'
                });
            }

            const messageModel = new MessageMVP();
            const messageData = {
                sender_id: senderId,
                receiver_id: parseInt(receiver_id),
                campaign_id: campaign_id ? parseInt(campaign_id) : null,
                application_id: application_id ? parseInt(application_id) : null,
                message,
                attachment_url
            };

            const sentMessage = await messageModel.sendMessage(messageData);

            console.log('✅ Message sent:', {
                messageId: sentMessage.id,
                from: senderId,
                to: receiver_id,
                campaignId: campaign_id
            });

            res.status(201).json({
                success: true,
                message: 'Message sent successfully',
                data: sentMessage
            });

        } catch (error) {
            console.error('❌ Send message error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send message'
            });
        }
    }

    // Get conversation between current user and another user
    static async getConversation(req, res) {
        try {
            const { userId } = req.params;
            const { campaign_id } = req.query;
            const currentUserId = req.user.id;

            if (parseInt(userId) === currentUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot get conversation with yourself'
                });
            }

            // Verify other user exists
            const userModel = new UserMVP();
            const otherUser = await userModel.findById(userId);

            if (!otherUser) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const messageModel = new MessageMVP();
            const messages = await messageModel.getConversation(currentUserId, userId, campaign_id);

            // Mark messages as read
            await messageModel.markAsRead(currentUserId, userId, campaign_id);

            // Get other user's profile info
            let otherUserProfile = null;
            if (otherUser.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                otherUserProfile = await restaurantModel.findByUserId(otherUser.id);
            } else if (otherUser.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                otherUserProfile = await influencerModel.findByUserId(otherUser.id);
            }

            // Get campaign info if specified
            let campaignInfo = null;
            if (campaign_id) {
                const campaignModel = new CampaignMVP();
                campaignInfo = await campaignModel.findById(campaign_id);
            }

            res.json({
                success: true,
                data: {
                    messages,
                    other_user: {
                        id: otherUser.id,
                        email: otherUser.email,
                        user_type: otherUser.user_type,
                        profile: otherUserProfile
                    },
                    campaign: campaignInfo,
                    conversation_id: `${Math.min(currentUserId, parseInt(userId))}-${Math.max(currentUserId, parseInt(userId))}`
                }
            });

        } catch (error) {
            console.error('❌ Get conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get conversation'
            });
        }
    }

    // Get all conversations for current user
    static async getConversations(req, res) {
        try {
            const userId = req.user.id;
            const { search } = req.query;

            const messageModel = new MessageMVP();
            let conversations = await messageModel.getUserConversations(userId);

            // Search functionality
            if (search) {
                const searchLower = search.toLowerCase();
                conversations = conversations.filter(conv =>
                    (conv.other_user_email && conv.other_user_email.toLowerCase().includes(searchLower)) ||
                    (conv.campaign_title && conv.campaign_title.toLowerCase().includes(searchLower))
                );
            }

            // Get additional profile info for each conversation
            const conversationsWithProfiles = await Promise.all(
                conversations.map(async (conv) => {
                    let profile = null;
                    if (conv.other_user_type === 'restaurant') {
                        const restaurantModel = new RestaurantMVP();
                        profile = await restaurantModel.findByUserId(conv.other_user_id);
                    } else if (conv.other_user_type === 'influencer') {
                        const influencerModel = new InfluencerMVP();
                        profile = await influencerModel.findByUserId(conv.other_user_id);
                    }

                    return {
                        ...conv,
                        other_user_profile: profile
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    conversations: conversationsWithProfiles,
                    total_unread: conversations.reduce((sum, conv) => sum + conv.unread_count, 0)
                }
            });

        } catch (error) {
            console.error('❌ Get conversations error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get conversations'
            });
        }
    }

    // Mark conversation as read
    static async markAsRead(req, res) {
        try {
            const { userId } = req.params;
            const { campaign_id } = req.body;
            const currentUserId = req.user.id;

            const messageModel = new MessageMVP();
            const updatedCount = await messageModel.markAsRead(currentUserId, userId, campaign_id);

            res.json({
                success: true,
                message: `${updatedCount} messages marked as read`,
                data: { updated_count: updatedCount }
            });

        } catch (error) {
            console.error('❌ Mark as read error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mark messages as read'
            });
        }
    }

    // Get unread message count
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const messageModel = new MessageMVP();
            const unreadCount = await messageModel.getUnreadCount(userId);

            res.json({
                success: true,
                data: { unread_count: unreadCount }
            });

        } catch (error) {
            console.error('❌ Get unread count error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get unread count'
            });
        }
    }

    // Search messages
    static async searchMessages(req, res) {
        try {
            const { q: searchTerm } = req.query;
            const userId = req.user.id;

            if (!searchTerm || searchTerm.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search term must be at least 2 characters'
                });
            }

            const messageModel = new MessageMVP();
            const messages = await messageModel.searchMessages(userId, searchTerm);

            res.json({
                success: true,
                data: {
                    messages,
                    search_term: searchTerm,
                    total_results: messages.length
                }
            });

        } catch (error) {
            console.error('❌ Search messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search messages'
            });
        }
    }

    // Delete message
    static async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;

            const messageModel = new MessageMVP();
            const deletedMessage = await messageModel.deleteMessage(messageId, userId);

            console.log('✅ Message deleted:', {
                messageId: deletedMessage.id,
                userId
            });

            res.json({
                success: true,
                message: 'Message deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete message error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete message'
            });
        }
    }

    // Get message statistics for dashboard
    static async getMessageStats(req, res) {
        try {
            const userId = req.user.id;
            const messageModel = new MessageMVP();
            const stats = await messageModel.getMessageStats(userId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('❌ Get message stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get message statistics'
            });
        }
    }

    // Start conversation (for campaigns/applications)
    static async startConversation(req, res) {
        try {
            const { user_id, campaign_id, application_id, initial_message } = req.body;
            const senderId = req.user.id;

            // Verify authorization to start conversation
            const canMessage = await MessageControllerMVP.canUsersMessage(senderId, user_id, campaign_id);
            if (!canMessage) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not authorized to start this conversation'
                });
            }

            // Send initial message if provided
            if (initial_message) {
                const messageModel = new MessageMVP();
                const messageData = {
                    sender_id: senderId,
                    receiver_id: parseInt(user_id),
                    campaign_id: campaign_id ? parseInt(campaign_id) : null,
                    application_id: application_id ? parseInt(application_id) : null,
                    message: initial_message
                };

                const sentMessage = await messageModel.sendMessage(messageData);

                res.status(201).json({
                    success: true,
                    message: 'Conversation started successfully',
                    data: {
                        message: sentMessage,
                        conversation_id: `${Math.min(senderId, parseInt(user_id))}-${Math.max(senderId, parseInt(user_id))}`
                    }
                });
            } else {
                res.json({
                    success: true,
                    message: 'Conversation initialized',
                    data: {
                        conversation_id: `${Math.min(senderId, parseInt(user_id))}-${Math.max(senderId, parseInt(user_id))}`
                    }
                });
            }

        } catch (error) {
            console.error('❌ Start conversation error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to start conversation'
            });
        }
    }

    // Helper method to check if users can message each other
    static async canUsersMessage(userId1, userId2, campaignId = null) {
        try {
            const userModel = new UserMVP();
            const [user1, user2] = await Promise.all([
                userModel.findById(userId1),
                userModel.findById(userId2)
            ]);

            if (!user1 || !user2) return false;

            // Admin can message anyone
            if (user1.user_type === 'admin' || user2.user_type === 'admin') {
                return true;
            }

            // If campaign-related, check if users are involved
            if (campaignId) {
                const campaignModel = new CampaignMVP();
                const campaign = await campaignModel.findById(campaignId);

                if (!campaign) return false;

                // Check if one user is restaurant owner of the campaign
                if (user1.user_type === 'restaurant' || user2.user_type === 'restaurant') {
                    const restaurantModel = new RestaurantMVP();
                    const restaurant1 = user1.user_type === 'restaurant' ? await restaurantModel.findByUserId(user1.id) : null;
                    const restaurant2 = user2.user_type === 'restaurant' ? await restaurantModel.findByUserId(user2.id) : null;

                    if ((restaurant1 && restaurant1.id === campaign.restaurant_id) ||
                        (restaurant2 && restaurant2.id === campaign.restaurant_id)) {
                        return true;
                    }
                }

                // Check if one user has applied to the campaign
                const applications = await campaignModel.getApplications(campaignId);
                const influencerModel = new InfluencerMVP();

                const influencer1 = user1.user_type === 'influencer' ? await influencerModel.findByUserId(user1.id) : null;
                const influencer2 = user2.user_type === 'influencer' ? await influencerModel.findByUserId(user2.id) : null;

                const hasApplication = applications.some(app =>
                    (influencer1 && app.influencer_id === influencer1.id) ||
                    (influencer2 && app.influencer_id === influencer2.id)
                );

                return hasApplication;
            }

            // For general messages, both users must be approved
            return user1.status === 'approved' && user2.status === 'approved';

        } catch (error) {
            console.error('Error checking message authorization:', error);
            return false;
        }
    }

    // Get contact list (for starting new conversations)
    static async getContactList(req, res) {
        try {
            const user = req.user;
            const { search } = req.query;

            let contacts = [];

            if (user.user_type === 'restaurant') {
                // Restaurants can contact influencers who applied to their campaigns
                const restaurantModel = new RestaurantMVP();
                const restaurant = await restaurantModel.findByUserId(user.id);

                if (restaurant) {
                    const campaignModel = new CampaignMVP();
                    const campaigns = await campaignModel.getByRestaurant(restaurant.id);

                    const applicantIds = new Set();
                    for (const campaign of campaigns) {
                        const applications = await campaignModel.getApplications(campaign.id);
                        applications.forEach(app => applicantIds.add(app.influencer_id));
                    }

                    const influencerModel = new InfluencerMVP();
                    for (const influencerId of applicantIds) {
                        const influencer = await influencerModel.findById(influencerId);
                        if (influencer) {
                            const userModel = new UserMVP();
                            const influencerUser = await userModel.findById(influencer.user_id);
                            contacts.push({
                                user_id: influencerUser.id,
                                email: influencerUser.email,
                                user_type: 'influencer',
                                profile: influencer
                            });
                        }
                    }
                }

            } else if (user.user_type === 'influencer') {
                // Influencers can contact restaurants they applied to
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(user.id);

                if (influencer) {
                    // Get campaigns where influencer applied
                    const campaignModel = new CampaignMVP();
                    const allCampaigns = await campaignModel.findAll();

                    const restaurantIds = new Set();
                    for (const campaign of allCampaigns) {
                        const applications = await campaignModel.getApplications(campaign.id, { influencer_id: influencer.id });
                        if (applications.length > 0) {
                            restaurantIds.add(campaign.restaurant_id);
                        }
                    }

                    const restaurantModel = new RestaurantMVP();
                    for (const restaurantId of restaurantIds) {
                        const restaurant = await restaurantModel.findById(restaurantId);
                        if (restaurant) {
                            const userModel = new UserMVP();
                            const restaurantUser = await userModel.findById(restaurant.user_id);
                            contacts.push({
                                user_id: restaurantUser.id,
                                email: restaurantUser.email,
                                user_type: 'restaurant',
                                profile: restaurant
                            });
                        }
                    }
                }
            }

            // Search functionality
            if (search) {
                const searchLower = search.toLowerCase();
                contacts = contacts.filter(contact =>
                    contact.email.toLowerCase().includes(searchLower) ||
                    (contact.profile.business_name && contact.profile.business_name.toLowerCase().includes(searchLower)) ||
                    (contact.profile.display_name && contact.profile.display_name.toLowerCase().includes(searchLower))
                );
            }

            res.json({
                success: true,
                data: {
                    contacts: contacts.slice(0, 50), // Limit to 50 contacts
                    total: contacts.length
                }
            });

        } catch (error) {
            console.error('❌ Get contact list error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get contact list'
            });
        }
    }
}

module.exports = MessageControllerMVP;