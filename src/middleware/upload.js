const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
        files: 10 // max 10 files
    },
    fileFilter: fileFilter
});

const uploadSingle = (fieldName) => {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: 'File too large. Maximum size is 5MB.' 
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ 
                        error: 'Too many files uploaded.' 
                    });
                }
                return res.status(400).json({ 
                    error: 'File upload error: ' + err.message 
                });
            } else if (err) {
                return res.status(400).json({ 
                    error: err.message 
                });
            }
            next();
        });
    };
};

const uploadMultiple = (fields) => {
    return (req, res, next) => {
        upload.fields(fields)(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: 'File too large. Maximum size is 5MB per file.' 
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ 
                        error: 'Too many files uploaded.' 
                    });
                }
                return res.status(400).json({ 
                    error: 'File upload error: ' + err.message 
                });
            } else if (err) {
                return res.status(400).json({ 
                    error: err.message 
                });
            }
            next();
        });
    };
};

const uploadArray = (fieldName, maxCount = 5) => {
    return (req, res, next) => {
        upload.array(fieldName, maxCount)(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        error: 'File too large. Maximum size is 5MB per file.' 
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ 
                        error: `Too many files. Maximum is ${maxCount} files.` 
                    });
                }
                return res.status(400).json({ 
                    error: 'File upload error: ' + err.message 
                });
            } else if (err) {
                return res.status(400).json({ 
                    error: err.message 
                });
            }
            next();
        });
    };
};

module.exports = {
    upload,
    uploadSingle,
    uploadMultiple,
    uploadArray
};