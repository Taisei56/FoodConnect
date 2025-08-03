const { verifyToken } = require('../config/jwt');
const { User, Restaurant, Influencer } = require('../models');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (user.status !== 'approved') {
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

        if (req.user.user_type === 'restaurant') {
            req.profile = await Restaurant.findByUserId(req.user.id);
        } else if (req.user.user_type === 'influencer') {
            req.profile = await Influencer.findByUserId(req.user.id);
        }

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
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId);
        
        if (user && user.status === 'approved') {
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