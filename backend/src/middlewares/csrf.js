const crypto = require('crypto');
const logger = require('../utils/logger');

const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const setCSRFToken = (req, res, next) => {
    if (!req.cookies.csrfToken) {
        const token = generateCSRFToken();
        
        res.cookie('csrfToken', token, {
            httpOnly: false, // Frontend'in okuması gerekiyor
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000 // 1 saat
        });
        
        req.csrfToken = token;
    } else {
        req.csrfToken = req.cookies.csrfToken;
    }
    
    next();
};

const validateCSRFToken = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    const cookieToken = req.cookies.csrfToken;
    const headerToken = req.headers['x-csrf-token'];
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        logger.securityEvent('CSRF_VIOLATION', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            hasCookieToken: !!cookieToken,
            hasHeaderToken: !!headerToken
        });
        
        return res.status(403).json({
            success: false,
            message: 'Geçersiz CSRF token',
            code: 'CSRF_VALIDATION_FAILED'
        });
    }
    
    next();
};

const getCSRFToken = (req, res) => {
    const token = generateCSRFToken();
    
    res.cookie('csrfToken', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000
    });
    
    res.json({
        success: true,
        csrfToken: token
    });
};

module.exports = {
    setCSRFToken,
    validateCSRFToken,
    getCSRFToken,
    generateCSRFToken
};
