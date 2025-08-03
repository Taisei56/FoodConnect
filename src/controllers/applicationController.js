const { Application, Campaign, Influencer, Restaurant, User } = require('../models');
const { sendEmail } = require('../config/email');

class ApplicationController {
    static async applyToCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { message } = req.body;

            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            if (campaign.status !== 'active') {
                return res.status(400).json({
                    error: 'Campaign is not active'
                });
            }

            if (campaign.deadline && new Date(campaign.deadline) < new Date()) {
                return res.status(400).json({
                    error: 'Campaign deadline has passed'
                });
            }

            const influencer = await Influencer.findByUserId(req.user.id);
            if (!influencer) {
                return res.status(404).json({
                    error: 'Influencer profile not found. Please create your profile first.'
                });
            }

            const existingApplication = await Application.checkExisting(campaignId, influencer.id);
            if (existingApplication) {
                return res.status(409).json({
                    error: 'You have already applied to this campaign'
                });
            }

            const currentApplications = await Application.getByCampaign(campaignId);
            const acceptedCount = currentApplications.filter(app => app.status === 'accepted').length;
            
            if (acceptedCount >= campaign.max_influencers) {
                return res.status(400).json({
                    error: 'Campaign has reached maximum number of influencers'
                });
            }

            const application = await Application.create({
                campaign_id: parseInt(campaignId),
                influencer_id: influencer.id,
                message
            });

            try {
                const restaurant = await Restaurant.findById(campaign.restaurant_id);
                if (restaurant) {
                    const emailSubject = `New Application for ${campaign.title}`;
                    const emailHtml = `
                        <h2>New Campaign Application</h2>
                        <p><strong>Campaign:</strong> ${campaign.title}</p>
                        <p><strong>Influencer:</strong> ${influencer.display_name}</p>
                        <p><strong>Instagram:</strong> ${influencer.instagram_handle || 'Not provided'}</p>
                        <p><strong>Followers:</strong> ${influencer.follower_count || 'Not provided'}</p>
                        <p><strong>Message:</strong></p>
                        <p>${message || 'No message provided'}</p>
                        <p>Please log in to your FoodConnect Malaysia account to review this application.</p>
                    `;
                    
                    await sendEmail(req.user.email, emailSubject, emailHtml);
                }
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
            }

            res.status(201).json({
                message: 'Application submitted successfully',
                application
            });
        } catch (error) {
            console.error('Apply to campaign error:', error);
            res.status(500).json({
                error: 'Failed to submit application'
            });
        }
    }

    static async getMyApplications(req, res) {
        try {
            const influencer = await Influencer.findByUserId(req.user.id);
            if (!influencer) {
                return res.status(404).json({
                    error: 'Influencer profile not found'
                });
            }

            const applications = await Application.getByInfluencer(influencer.id);

            const applicationsWithDetails = applications.map(app => ({
                ...app,
                budget_per_influencer: parseFloat(app.budget_per_influencer),
                is_expired: app.deadline && new Date(app.deadline) < new Date()
            }));

            res.json({
                message: 'Applications retrieved successfully',
                applications: applicationsWithDetails,
                total: applicationsWithDetails.length
            });
        } catch (error) {
            console.error('Get my applications error:', error);
            res.status(500).json({
                error: 'Failed to retrieve applications'
            });
        }
    }

    static async getCampaignApplications(req, res) {
        try {
            const { campaignId } = req.params;

            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only view applications for your own campaigns'
                });
            }

            const applications = await Application.getByCampaign(campaignId);

            res.json({
                message: 'Campaign applications retrieved successfully',
                applications,
                total: applications.length,
                campaign: {
                    id: campaign.id,
                    title: campaign.title,
                    max_influencers: campaign.max_influencers
                }
            });
        } catch (error) {
            console.error('Get campaign applications error:', error);
            res.status(500).json({
                error: 'Failed to retrieve campaign applications'
            });
        }
    }

    static async updateApplicationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const application = await Application.findById(id);
            if (!application) {
                return res.status(404).json({
                    error: 'Application not found'
                });
            }

            const campaign = await Campaign.findById(application.campaign_id);
            if (!campaign) {
                return res.status(404).json({
                    error: 'Campaign not found'
                });
            }

            const restaurant = await Restaurant.findByUserId(req.user.id);
            if (!restaurant || campaign.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    error: 'You can only update applications for your own campaigns'
                });
            }

            if (status === 'accepted') {
                const currentApplications = await Application.getByCampaign(application.campaign_id);
                const acceptedCount = currentApplications.filter(app => 
                    app.status === 'accepted' && app.id !== parseInt(id)
                ).length;
                
                if (acceptedCount >= campaign.max_influencers) {
                    return res.status(400).json({
                        error: 'Campaign has reached maximum number of influencers'
                    });
                }
            }

            const updatedApplication = await Application.updateStatus(id, status);

            try {
                const influencer = await Influencer.findById(application.influencer_id);
                if (influencer) {
                    const statusMessages = {
                        accepted: 'Congratulations! Your application has been accepted.',
                        rejected: 'Unfortunately, your application was not selected this time.'
                    };

                    const emailSubject = `Application Update: ${campaign.title}`;
                    const emailHtml = `
                        <h2>Campaign Application Update</h2>
                        <p><strong>Campaign:</strong> ${campaign.title}</p>
                        <p><strong>Restaurant:</strong> ${campaign.business_name}</p>
                        <p><strong>Status:</strong> ${status.toUpperCase()}</p>
                        <p>${statusMessages[status]}</p>
                        ${status === 'accepted' ? `
                            <p><strong>Budget:</strong> RM ${campaign.budget_per_influencer}</p>
                            <p>Please log in to your account for more details and next steps.</p>
                        ` : ''}
                        <p>Thank you for using FoodConnect Malaysia!</p>
                    `;
                    
                    const user = await User.findById(influencer.user_id);
                    if (user) {
                        await sendEmail(user.email, emailSubject, emailHtml);
                    }
                }
            } catch (emailError) {
                console.error('Failed to send status update email:', emailError);
            }

            res.json({
                message: `Application ${status} successfully`,
                application: updatedApplication
            });
        } catch (error) {
            console.error('Update application status error:', error);
            res.status(500).json({
                error: 'Failed to update application status'
            });
        }
    }

    static async withdrawApplication(req, res) {
        try {
            const { id } = req.params;

            const application = await Application.findById(id);
            if (!application) {
                return res.status(404).json({
                    error: 'Application not found'
                });
            }

            const influencer = await Influencer.findByUserId(req.user.id);
            if (!influencer || application.influencer_id !== influencer.id) {
                return res.status(403).json({
                    error: 'You can only withdraw your own applications'
                });
            }

            if (application.status === 'accepted') {
                return res.status(400).json({
                    error: 'Cannot withdraw an accepted application. Please contact the restaurant directly.'
                });
            }

            await Application.delete(id);

            res.json({
                message: 'Application withdrawn successfully'
            });
        } catch (error) {
            console.error('Withdraw application error:', error);
            res.status(500).json({
                error: 'Failed to withdraw application'
            });
        }
    }

    static async getApplicationById(req, res) {
        try {
            const { id } = req.params;

            const application = await Application.findById(id);
            if (!application) {
                return res.status(404).json({
                    error: 'Application not found'
                });
            }

            const influencer = await Influencer.findByUserId(req.user.id);
            const restaurant = await Restaurant.findByUserId(req.user.id);

            const hasAccess = (influencer && application.influencer_id === influencer.id) ||
                             (restaurant && application.restaurant_id === restaurant.id);

            if (!hasAccess) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }

            res.json({
                message: 'Application retrieved successfully',
                application
            });
        } catch (error) {
            console.error('Get application by ID error:', error);
            res.status(500).json({
                error: 'Failed to retrieve application'
            });
        }
    }
}

module.exports = ApplicationController;