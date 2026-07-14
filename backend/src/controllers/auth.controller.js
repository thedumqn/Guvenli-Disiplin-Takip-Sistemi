const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 5, // 5 deneme
    message: {
        success: false,
        message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyiniz.',
        code: 'TOO_MANY_ATTEMPTS'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`
});

const generateTokens = (userId, sessionId) => {
    const accessToken = jwt.sign(
        { id: userId, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );
    
    const refreshToken = jwt.sign(
        { id: userId, sessionId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );
    
    return { accessToken, refreshToken };
};

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
};

const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    
    const user = await User.findByEmailWithPassword(email);
    
    if (!user) {
        await require('bcrypt').hash('dummy', 12);
        
        logger.authFailure({
            email,
            ip: req.ip,
            reason: 'Kullanıcı bulunamadı'
        });
        
        return next(new AppError('Email veya şifre hatalı', 401, 'INVALID_CREDENTIALS'));
    }
    
    if (user.isLocked) {
        const lockMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
        
        logger.authFailure({
            userId: user._id,
            email,
            ip: req.ip,
            reason: 'Hesap kilitli'
        });
        
        await AuditLog.log({
            action: 'LOGIN_FAILURE',
            category: 'AUTH',
            user,
            details: { reason: 'account_locked', lockMinutes },
            client: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            },
            result: { success: false, statusCode: 423 },
            severity: 'MEDIUM'
        });
        
        return next(new AppError(
            `Hesabınız kilitlendi. ${lockMinutes} dakika sonra tekrar deneyiniz.`,
            423,
            'ACCOUNT_LOCKED'
        ));
    }
    
    if (!user.isActive) {
        logger.authFailure({
            userId: user._id,
            email,
            ip: req.ip,
            reason: 'Hesap deaktif'
        });
        
        return next(new AppError('Hesabınız devre dışı bırakılmıştır', 403, 'ACCOUNT_DISABLED'));
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
        await user.incLoginAttempts();
        
        logger.authFailure({
            userId: user._id,
            email,
            ip: req.ip,
            reason: 'Yanlış şifre',
            attempts: user.loginAttempts + 1
        });
        
        await AuditLog.log({
            action: 'LOGIN_FAILURE',
            category: 'AUTH',
            user,
            details: { reason: 'wrong_password', attempts: user.loginAttempts + 1 },
            client: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            },
            result: { success: false, statusCode: 401 },
            severity: 'MEDIUM'
        });
        
        return next(new AppError('Email veya şifre hatalı', 401, 'INVALID_CREDENTIALS'));
    }
    
    await user.resetLoginAttempts();
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    user.activeSessions = user.activeSessions || [];
    user.activeSessions.push({
        sessionId,
        deviceInfo: req.get('User-Agent'),
        ipAddress: req.ip,
        createdAt: new Date(),
        lastActivity: new Date()
    });
    
    if (user.activeSessions.length > 5) {
        user.activeSessions = user.activeSessions.slice(-5);
    }
    
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    await user.save({ validateBeforeSave: false });
    
    const { accessToken, refreshToken } = generateTokens(user._id, sessionId);
    
    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 dakika
    });
    
    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
    });
    
    await AuditLog.log({
        action: 'LOGIN_SUCCESS',
        category: 'AUTH',
        user,
        details: { sessionId },
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 }
    });
    
    logger.info(`Kullanıcı giriş yaptı: ${user.email} (${req.ip})`);
    
    res.status(200).json({
        success: true,
        message: 'Giriş başarılı',
        data: {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                permissions: user.permissions
            },
            accessToken // Header için de gönder
        }
    });
});

const refreshToken = asyncHandler(async (req, res, next) => {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!token) {
        return next(new AppError('Refresh token bulunamadı', 401, 'NO_REFRESH_TOKEN'));
    }
    
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        return next(new AppError('Geçersiz veya süresi dolmuş token', 401, 'INVALID_REFRESH_TOKEN'));
    }
    
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
        return next(new AppError('Kullanıcı bulunamadı', 401));
    }
    
    const validSession = user.activeSessions?.find(s => s.sessionId === decoded.sessionId);
    if (!validSession) {
        return next(new AppError('Oturum sonlandırılmış', 401, 'SESSION_INVALID'));
    }
    
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, decoded.sessionId);
    
    validSession.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });
    
    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
    });
    
    res.cookie('refreshToken', newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.status(200).json({
        success: true,
        accessToken
    });
});

const logout = asyncHandler(async (req, res, next) => {
    if (req.user && req.sessionId) {
        req.user.activeSessions = req.user.activeSessions.filter(
            s => s.sessionId !== req.sessionId
        );
        await req.user.save({ validateBeforeSave: false });
        
        await AuditLog.log({
            action: 'LOGOUT',
            category: 'AUTH',
            user: req.user,
            details: { sessionId: req.sessionId },
            client: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            },
            result: { success: true, statusCode: 200 }
        });
    }
    
    res.cookie('accessToken', '', { ...cookieOptions, maxAge: 0 });
    res.cookie('refreshToken', '', { ...cookieOptions, maxAge: 0 });
    res.cookie('csrfToken', '', { maxAge: 0 });
    
    res.status(200).json({
        success: true,
        message: 'Çıkış başarılı'
    });
});

const logoutAll = asyncHandler(async (req, res, next) => {
    req.user.activeSessions = [];
    await req.user.save({ validateBeforeSave: false });
    
    await AuditLog.log({
        action: 'LOGOUT',
        category: 'AUTH',
        user: req.user,
        details: { type: 'logout_all' },
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 }
    });
    
    res.cookie('accessToken', '', { ...cookieOptions, maxAge: 0 });
    res.cookie('refreshToken', '', { ...cookieOptions, maxAge: 0 });
    
    res.status(200).json({
        success: true,
        message: 'Tüm oturumlar kapatıldı'
    });
});

const changePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password +passwordHistory');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        return next(new AppError('Mevcut şifre hatalı', 401, 'WRONG_PASSWORD'));
    }
    
    user.password = newPassword;
    await user.save();
    
    user.activeSessions = [];
    await user.save({ validateBeforeSave: false });
    
    await AuditLog.log({
        action: 'PASSWORD_CHANGE',
        category: 'AUTH',
        user,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 },
        severity: 'HIGH'
    });
    
    res.cookie('accessToken', '', { ...cookieOptions, maxAge: 0 });
    res.cookie('refreshToken', '', { ...cookieOptions, maxAge: 0 });
    
    res.status(200).json({
        success: true,
        message: 'Şifre başarıyla değiştirildi. Lütfen tekrar giriş yapınız.'
    });
});

const getMe = asyncHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        data: {
            user: req.user
        }
    });
});

const getSessions = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id);
    
    const sessions = user.activeSessions.map(s => ({
        sessionId: s.sessionId,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        isCurrent: s.sessionId === req.sessionId
    }));
    
    res.status(200).json({
        success: true,
        data: sessions
    });
});

const revokeSession = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    
    req.user.activeSessions = req.user.activeSessions.filter(
        s => s.sessionId !== sessionId
    );
    await req.user.save({ validateBeforeSave: false });
    
    res.status(200).json({
        success: true,
        message: 'Oturum kapatıldı'
    });
});

module.exports = {
    login,
    loginLimiter,
    refreshToken,
    logout,
    logoutAll,
    changePassword,
    getMe,
    getSessions,
    revokeSession
};
