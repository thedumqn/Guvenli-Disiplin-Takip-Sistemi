const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }
        
        if (!token) {
            logger.authFailure({
                ip: req.ip,
                path: req.path,
                reason: 'Token bulunamadı'
            });
            
            return res.status(401).json({
                success: false,
                message: 'Bu işlem için giriş yapmanız gerekmektedir'
            });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Oturum süreniz dolmuştur. Lütfen tekrar giriş yapınız',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (error.name === 'JsonWebTokenError') {
                logger.securityEvent('INVALID_TOKEN', {
                    ip: req.ip,
                    path: req.path,
                    error: error.message
                });
                
                return res.status(401).json({
                    success: false,
                    message: 'Geçersiz token'
                });
            }
            throw error;
        }
        
        const user = await User.findById(decoded.id).select('+passwordChangedAt');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Bu token\'a ait kullanıcı bulunamadı'
            });
        }
        
        if (!user.isActive) {
            logger.accessDenied({
                userId: user._id,
                ip: req.ip,
                reason: 'Hesap deaktif'
            });
            
            return res.status(401).json({
                success: false,
                message: 'Hesabınız devre dışı bırakılmıştır'
            });
        }
        
        if (user.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                success: false,
                message: 'Şifreniz değiştirilmiştir. Lütfen tekrar giriş yapınız',
                code: 'PASSWORD_CHANGED'
            });
        }
        
        if (decoded.sessionId) {
            const validSession = user.activeSessions?.find(
                s => s.sessionId === decoded.sessionId
            );
            
            if (!validSession) {
                return res.status(401).json({
                    success: false,
                    message: 'Oturum sonlandırılmıştır',
                    code: 'SESSION_INVALID'
                });
            }
        }
        
        req.user = user;
        req.sessionId = decoded.sessionId;
        
        next();
    } catch (error) {
        logger.error('Auth middleware hatası:', error);
        return res.status(500).json({
            success: false,
            message: 'Kimlik doğrulama hatası'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Kimlik doğrulaması gerekli'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            logger.accessDenied({
                userId: req.user._id,
                userRole: req.user.role,
                requiredRoles: roles,
                path: req.path,
                ip: req.ip
            });
            
            AuditLog.log({
                action: 'UNAUTHORIZED_ACCESS',
                category: 'SECURITY',
                user: req.user,
                resource: {
                    type: 'System',
                    identifier: req.path
                },
                details: {
                    requiredRoles: roles,
                    userRole: req.user.role
                },
                request: req,
                client: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                },
                result: {
                    success: false,
                    statusCode: 403,
                    errorMessage: 'Yetkisiz erişim denemesi'
                },
                severity: 'HIGH'
            }).catch(err => logger.error('Audit log hatası:', err));
            
            return res.status(403).json({
                success: false,
                message: 'Bu işlem için yetkiniz bulunmamaktadır'
            });
        }
        
        next();
    };
};

const hasPermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Kimlik doğrulaması gerekli'
            });
        }
        
        if (req.user.role === 'admin') {
            return next();
        }
        
        const userPermissions = req.user.permissions || [];
        const hasAllPermissions = permissions.every(p => userPermissions.includes(p));
        
        if (!hasAllPermissions) {
            logger.accessDenied({
                userId: req.user._id,
                userPermissions,
                requiredPermissions: permissions,
                path: req.path,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                message: 'Bu işlem için gerekli izinlere sahip değilsiniz'
            });
        }
        
        next();
    };
};

const ownerOrAdmin = (paramName = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Kimlik doğrulaması gerekli'
            });
        }
        
        if (req.user.role === 'admin') {
            return next();
        }
        
        const resourceId = req.params[paramName];
        
        if (req.user._id.toString() !== resourceId) {
            logger.accessDenied({
                userId: req.user._id,
                resourceId,
                path: req.path,
                reason: 'Başkasının kaynağına erişim denemesi'
            });
            
            return res.status(403).json({
                success: false,
                message: 'Bu kaynağa erişim yetkiniz yok'
            });
        }
        
        next();
    };
};

const requireEmailVerified = (req, res, next) => {
    if (!req.user.isEmailVerified) {
        return res.status(403).json({
            success: false,
            message: 'Bu işlem için email adresinizi doğrulamanız gerekmektedir',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }
    next();
};

const requireMFA = (req, res, next) => {
    if (req.user.mfaEnabled && !req.mfaVerified) {
        return res.status(403).json({
            success: false,
            message: 'Bu işlem için iki faktörlü doğrulama gereklidir',
            code: 'MFA_REQUIRED'
        });
    }
    next();
};

module.exports = {
    protect,
    authorize,
    hasPermission,
    ownerOrAdmin,
    requireEmailVerified,
    requireMFA
};
