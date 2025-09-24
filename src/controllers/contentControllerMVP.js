const ContentMVP = require('../models/ContentMVP');
const CampaignMVP = require('../models/CampaignMVP');
const InfluencerMVP = require('../models/InfluencerMVP');
const RestaurantMVP = require('../models/RestaurantMVP');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

class ContentControllerMVP {
    // Content submission validation
    static getContentValidation() {
        return [
            body('application_id')
                .isInt({ min: 1 })
                .withMessage('Valid application ID is required'),
            body('video_url')
                .isURL()
                .withMessage('Valid video URL is required')
                .custom((value) => {
                    if (!ContentMVP.validateVideoUrl(value)) {
                        throw new Error('Invalid video URL. Must be from supported platforms or direct video file');
                    }
                    return true;
                }),
            body('description')
                .optional()
                .isLength({ max: 1000 })
                .withMessage('Description must not exceed 1000 characters'),
            body('platforms')
                .isArray({ min: 1 })
                .withMessage('At least one platform must be specified')
        ];
    }

    // Setup multer for file uploads
    static setupFileUpload() {
        // Ensure upload directory exists
        const uploadDir = path.join(__dirname, '../../data/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
            }
        });

        const fileFilter = (req, file, cb) => {
            const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|wmv|flv|webm/;
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype);

            if (mimetype && extname) {
                return cb(null, true);
            } else {
                cb(new Error('Only images and videos are allowed'));
            }
        };

        return multer({
            storage: storage,
            limits: {
                fileSize: 100 * 1024 * 1024 // 100MB limit
            },
            fileFilter: fileFilter
        });
    }

    // Submit content for review
    static async submitContent(req, res) {
        try {
            console.log('🔄 Submitting content for review');

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { application_id, video_url, description, platforms } = req.body;
            const user = req.user;

            if (user.user_type !== 'influencer') {
                return res.status(403).json({
                    success: false,
                    error: 'Only influencers can submit content'
                });
            }

            // Get influencer profile
            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findByUserId(user.id);

            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            // Verify application belongs to influencer
            const campaignModel = new CampaignMVP();
            const applications = await campaignModel.getApplications(null, { application_id });

            if (applications.length === 0 || applications[0].influencer_id !== influencer.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Application not found or access denied'
                });
            }

            const application = applications[0];

            if (application.status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: 'Application must be accepted before submitting content'
                });
            }

            // Check if content already submitted
            const contentModel = new ContentMVP();
            const existingContent = await contentModel.getByApplication(application_id);

            if (existingContent.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Content has already been submitted for this application'
                });
            }

            // Create content submission
            const contentData = {
                application_id: parseInt(application_id),
                video_url,
                description: description || '',
                platforms: Array.isArray(platforms) ? platforms : [platforms]
            };

            const submission = await contentModel.submitContent(contentData);

            console.log('✅ Content submitted:', {
                submissionId: submission.id,
                applicationId: application_id,
                influencerId: influencer.id
            });

            res.status(201).json({
                success: true,
                message: 'Content submitted successfully for review',
                data: {
                    submission,
                    next_steps: [
                        'Restaurant will review your content',
                        'You will receive email notification when reviewed',
                        'If approved, post on all specified platforms',
                        'Payment will be processed after posting confirmation'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Submit content error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to submit content'
            });
        }
    }

    // Get content submissions for influencer
    static async getInfluencerContent(req, res) {
        try {
            const user = req.user;
            const { status, campaign_id, page = 1, limit = 10 } = req.query;

            if (user.user_type !== 'influencer') {
                return res.status(403).json({
                    success: false,
                    error: 'Only influencers can access this endpoint'
                });
            }

            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findByUserId(user.id);

            if (!influencer) {
                return res.status(404).json({
                    success: false,
                    error: 'Influencer profile not found'
                });
            }

            const contentModel = new ContentMVP();
            const filters = { influencer_id: influencer.id };
            if (status) filters.status = status;
            if (campaign_id) filters.campaign_id = campaign_id;

            const content = await contentModel.findAll(filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedContent = content.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    content: paginatedContent,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: content.length,
                        total_pages: Math.ceil(content.length / limit)
                    },
                    summary: {
                        total_submissions: content.length,
                        pending_review: content.filter(c => c.status === 'pending').length,
                        approved: content.filter(c => c.status === 'approved').length,
                        posted: content.filter(c => c.status === 'posted').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get influencer content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content submissions'
            });
        }
    }

    // Get content submissions for restaurant
    static async getRestaurantContent(req, res) {
        try {
            const user = req.user;
            const { status, campaign_id, page = 1, limit = 10 } = req.query;

            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can access this endpoint'
                });
            }

            const restaurantModel = new RestaurantMVP();
            const restaurant = await restaurantModel.findByUserId(user.id);

            if (!restaurant) {
                return res.status(404).json({
                    success: false,
                    error: 'Restaurant profile not found'
                });
            }

            const contentModel = new ContentMVP();
            const filters = { restaurant_id: restaurant.id };
            if (status) filters.status = status;
            if (campaign_id) filters.campaign_id = campaign_id;

            const content = await contentModel.findAll(filters);

            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedContent = content.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    content: paginatedContent,
                    pagination: {
                        current_page: parseInt(page),
                        per_page: parseInt(limit),
                        total: content.length,
                        total_pages: Math.ceil(content.length / limit)
                    },
                    summary: {
                        pending_review: content.filter(c => c.status === 'pending').length,
                        approved: content.filter(c => c.status === 'approved').length,
                        rejected: content.filter(c => c.status === 'rejected').length,
                        posted: content.filter(c => c.status === 'posted').length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get restaurant content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content submissions'
            });
        }
    }

    // Get single content submission
    static async getContent(req, res) {
        try {
            const { contentId } = req.params;
            const user = req.user;

            const contentModel = new ContentMVP();
            const content = await contentModel.findById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content submission not found'
                });
            }

            // Check access permissions
            let hasAccess = false;

            if (user.user_type === 'admin') {
                hasAccess = true;
            } else if (user.user_type === 'restaurant') {
                const restaurantModel = new RestaurantMVP();
                const restaurant = await restaurantModel.findByUserId(user.id);
                hasAccess = restaurant && content.restaurant_id === restaurant.id;
            } else if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(user.id);
                hasAccess = influencer && content.influencer_id === influencer.id;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            res.json({
                success: true,
                data: {
                    content,
                    workflow: ContentMVP.getContentWorkflow(),
                    status_labels: ContentMVP.getStatusLabels(),
                    supported_platforms: ContentMVP.getSupportedPlatforms()
                }
            });

        } catch (error) {
            console.error('❌ Get content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content submission'
            });
        }
    }

    // Review content (restaurant)
    static async reviewContent(req, res) {
        try {
            const { contentId } = req.params;
            const { action, feedback } = req.body; // action: 'approve' or 'reject'
            const user = req.user;

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be either approve or reject'
                });
            }

            if (user.user_type !== 'restaurant') {
                return res.status(403).json({
                    success: false,
                    error: 'Only restaurants can review content'
                });
            }

            const contentModel = new ContentMVP();
            const content = await contentModel.findById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content submission not found'
                });
            }

            // Verify restaurant owns the campaign
            const restaurantModel = new RestaurantMVP();
            const restaurant = await restaurantModel.findByUserId(user.id);

            if (!restaurant || content.restaurant_id !== restaurant.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            if (content.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Content must be pending to review'
                });
            }

            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const updatedContent = await contentModel.updateStatus(contentId, newStatus, feedback);

            console.log(`✅ Content ${action}d:`, {
                contentId: content.id,
                campaignId: content.campaign_id,
                influencerId: content.influencer_id,
                restaurantId: restaurant.id
            });

            res.json({
                success: true,
                message: `Content ${action}d successfully`,
                data: {
                    content: updatedContent,
                    next_steps: action === 'approve' ? [
                        'Influencer will post on specified platforms',
                        'Influencer will mark as posted when live',
                        'Payment will be processed after posting confirmation'
                    ] : [
                        'Influencer has been notified of rejection',
                        'Influencer can revise and resubmit content',
                        'Check feedback provided for improvement suggestions'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Review content error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to review content'
            });
        }
    }

    // Mark content as posted (influencer)
    static async markAsPosted(req, res) {
        try {
            const { contentId } = req.params;
            const { platforms } = req.body;
            const user = req.user;

            if (user.user_type !== 'influencer') {
                return res.status(403).json({
                    success: false,
                    error: 'Only influencers can mark content as posted'
                });
            }

            const contentModel = new ContentMVP();
            const content = await contentModel.findById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content submission not found'
                });
            }

            // Verify influencer owns the content
            const influencerModel = new InfluencerMVP();
            const influencer = await influencerModel.findByUserId(user.id);

            if (!influencer || content.influencer_id !== influencer.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            if (content.status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    error: 'Content must be approved before marking as posted'
                });
            }

            const updatedContent = await contentModel.markAsPosted(contentId, platforms || content.platforms);

            console.log('✅ Content marked as posted:', {
                contentId: content.id,
                platforms: platforms || content.platforms,
                influencerId: influencer.id
            });

            res.json({
                success: true,
                message: 'Content marked as posted successfully',
                data: {
                    content: updatedContent,
                    next_steps: [
                        'Restaurant has been notified',
                        'Payment processing will begin',
                        'Check your payments section for status updates'
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Mark as posted error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to mark content as posted'
            });
        }
    }

    // Update content submission
    static async updateContent(req, res) {
        try {
            const { contentId } = req.params;
            const user = req.user;

            const contentModel = new ContentMVP();
            const content = await contentModel.findById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content submission not found'
                });
            }

            // Check permissions
            let hasAccess = false;

            if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(user.id);
                hasAccess = influencer && content.influencer_id === influencer.id;

                // Influencers can only update pending content
                if (hasAccess && content.status !== 'pending') {
                    return res.status(400).json({
                        success: false,
                        error: 'Can only update pending content submissions'
                    });
                }
            } else if (user.user_type === 'admin') {
                hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const updateData = {};
            const allowedFields = ['video_url', 'description', 'platforms'];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Validate video URL if provided
            if (updateData.video_url && !ContentMVP.validateVideoUrl(updateData.video_url)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid video URL'
                });
            }

            const updatedContent = await contentModel.update(contentId, updateData);

            console.log('✅ Content updated:', {
                contentId: content.id,
                updatedFields: Object.keys(updateData)
            });

            res.json({
                success: true,
                message: 'Content submission updated successfully',
                data: updatedContent
            });

        } catch (error) {
            console.error('❌ Update content error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update content submission'
            });
        }
    }

    // Upload file
    static async uploadFile(req, res) {
        try {
            const upload = ContentControllerMVP.setupFileUpload();

            upload.single('file')(req, res, (err) => {
                if (err) {
                    console.error('❌ File upload error:', err);
                    return res.status(400).json({
                        success: false,
                        error: err.message || 'File upload failed'
                    });
                }

                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        error: 'No file uploaded'
                    });
                }

                const fileUrl = `/uploads/${req.file.filename}`;

                console.log('✅ File uploaded:', {
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                });

                res.json({
                    success: true,
                    message: 'File uploaded successfully',
                    data: {
                        file_url: fileUrl,
                        filename: req.file.filename,
                        original_name: req.file.originalname,
                        size: req.file.size,
                        mimetype: req.file.mimetype
                    }
                });
            });

        } catch (error) {
            console.error('❌ Upload file error:', error);
            res.status(500).json({
                success: false,
                error: 'File upload failed'
            });
        }
    }

    // Get content statistics (admin)
    static async getContentStats(req, res) {
        try {
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can access content statistics'
                });
            }

            const { campaign_id, influencer_id, restaurant_id } = req.query;
            const filters = {};

            if (campaign_id) filters.campaign_id = campaign_id;
            if (influencer_id) filters.influencer_id = influencer_id;
            if (restaurant_id) filters.restaurant_id = restaurant_id;

            const contentModel = new ContentMVP();
            const stats = await contentModel.getStats(filters);

            res.json({
                success: true,
                data: {
                    statistics: stats,
                    status_labels: ContentMVP.getStatusLabels()
                }
            });

        } catch (error) {
            console.error('❌ Get content stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content statistics'
            });
        }
    }

    // Get pending content for admin review
    static async getPendingContent(req, res) {
        try {
            const user = req.user;

            if (user.user_type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can access pending content'
                });
            }

            const contentModel = new ContentMVP();
            const pendingContent = await contentModel.getPendingContent();

            res.json({
                success: true,
                data: {
                    pending_content: pendingContent,
                    total_count: pendingContent.length
                }
            });

        } catch (error) {
            console.error('❌ Get pending content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending content'
            });
        }
    }

    // Delete content submission
    static async deleteContent(req, res) {
        try {
            const { contentId } = req.params;
            const user = req.user;

            const contentModel = new ContentMVP();
            const content = await contentModel.findById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content submission not found'
                });
            }

            // Check permissions (only influencer who created it or admin)
            let hasAccess = false;

            if (user.user_type === 'influencer') {
                const influencerModel = new InfluencerMVP();
                const influencer = await influencerModel.findByUserId(user.id);
                hasAccess = influencer && content.influencer_id === influencer.id && content.status === 'pending';
            } else if (user.user_type === 'admin') {
                hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied or content cannot be deleted'
                });
            }

            await contentModel.delete(contentId);

            console.log('✅ Content deleted:', {
                contentId: content.id,
                deletedBy: user.id
            });

            res.json({
                success: true,
                message: 'Content submission deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete content error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete content submission'
            });
        }
    }

    // Get content form data
    static async getContentFormData(req, res) {
        res.json({
            success: true,
            data: {
                supported_platforms: ContentMVP.getSupportedPlatforms(),
                status_labels: ContentMVP.getStatusLabels(),
                content_workflow: ContentMVP.getContentWorkflow(),
                file_requirements: {
                    max_size: '100MB',
                    supported_formats: ['MP4', 'MOV', 'AVI', 'WMV', 'FLV', 'WebM'],
                    supported_platforms: ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Direct Upload']
                }
            }
        });
    }
}

module.exports = ContentControllerMVP;