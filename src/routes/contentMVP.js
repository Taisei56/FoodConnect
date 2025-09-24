const express = require('express');
const router = express.Router();
const contentControllerMVP = require('../controllers/contentControllerMVP');
const authControllerMVP = require('../controllers/authControllerMVP');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/content/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|mov|avi|wmv|flv|webm|mkv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Submit content for review
router.post('/submit',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('influencer'),
    upload.single('video_file'),
    contentControllerMVP.submitContent
);

// Get influencer's content
router.get('/influencer',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('influencer'),
    contentControllerMVP.getInfluencerContent
);

// Get restaurant's content for review
router.get('/restaurant',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    contentControllerMVP.getRestaurantContent
);

// Get content details
router.get('/:id',
    authControllerMVP.requireAuth,
    contentControllerMVP.getContent
);

// Review content (approve/reject)
router.post('/:id/review',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('restaurant'),
    contentControllerMVP.reviewContent
);

// Mark content as posted
router.post('/:id/posted',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('influencer'),
    contentControllerMVP.markAsPosted
);

// Update content
router.put('/:id',
    authControllerMVP.requireAuth,
    contentControllerMVP.updateContent
);

// Get content statistics
router.get('/stats/overview',
    authControllerMVP.requireAuth,
    contentControllerMVP.getContentStats
);

// Get pending content (admin)
router.get('/admin/pending',
    authControllerMVP.requireAuth,
    authControllerMVP.requireRole('admin'),
    contentControllerMVP.getPendingContent
);

// Upload files
router.post('/upload',
    authControllerMVP.requireAuth,
    upload.array('files', 5),
    contentControllerMVP.uploadFile
);

module.exports = router;