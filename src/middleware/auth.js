const jwt = require('jsonwebtoken');
const UserMVP = require('../models/UserMVP');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const userMVP = new UserMVP();
        const user = await userMVP.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (user.status !== 'approved' && user.user_type !== 'admin') {
            return res.status(403).json({ 
                error: 'Account not approved', 
                status: user.status 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (req.user.user_type !== requiredRole) {
            return res.status(403).json({ 
                error: `Access denied. ${requiredRole} role required.` 
            });
        }

        next();
    };
};

const attachProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            return next();
        }

        // Profile attachment simplified for now
        req.profile = null;

        next();
    } catch (error) {
        console.error('Profile attachment error:', error);
        next();
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const userMVP = new UserMVP();
        const user = await userMVP.findById(decoded.id);
        
        if (user && (user.status === 'approved' || user.user_type === 'admin')) {
            req.user = user;
        }
    } catch (error) {
        console.error('Optional auth error:', error);
    }

    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    attachProfile,
    optionalAuth
};