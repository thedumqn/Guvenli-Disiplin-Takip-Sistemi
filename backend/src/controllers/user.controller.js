const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const register = asyncHandler(async (req, res, next) => {
    const { tcKimlik, email, password, passwordConfirm, firstName, lastName, role } = req.body;

    if (password !== passwordConfirm) {
        return next(new AppError('Şifreler eşleşmiyor', 400));
    }

    const allowedRoles = ['izleyici', 'ogrenci_isleri', 'kurul_uyesi'];
    const selectedRole = allowedRoles.includes(role) ? role : 'izleyici';

    const defaultPermissions = {
        'izleyici': ['read_record'],
        'ogrenci_isleri': ['read_record', 'manage_students'],
        'kurul_uyesi': ['create_record', 'read_record', 'update_record']
    };

    const user = await User.create({
        tcKimlik,
        email,
        password,
        firstName,
        lastName,
        role: selectedRole,
        permissions: defaultPermissions[selectedRole] || ['read_record'],
        isActive: true,
        isEmailVerified: false
    });

    await AuditLog.log({
        action: 'USER_CREATE',
        category: 'USER',
        user: user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        details: {
            role: user.role,
            registrationType: 'self_registration'
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 201 }
    });

    logger.info(`Yeni kullanıcı kaydı: ${user.email}`);

    res.status(201).json({
        success: true,
        message: 'Hesabınız başarıyla oluşturuldu',
        data: {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        }
    });
});

const getUsers = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
        success: true,
        data: users,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

const getUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new AppError('Kullanıcı bulunamadı', 404));
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

const createUser = asyncHandler(async (req, res, next) => {
    const { tcKimlik, email, password, firstName, lastName, role, permissions } = req.body;

    const user = await User.create({
        tcKimlik,
        email,
        password,
        firstName,
        lastName,
        role: role || 'izleyici',
        permissions: permissions || [],
        isActive: true,
        createdBy: req.user._id
    });

    await AuditLog.log({
        action: 'USER_CREATE',
        category: 'USER',
        user: req.user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        details: {
            newUserRole: user.role,
            createdByAdmin: true
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 201 }
    });

    logger.info(`Admin tarafından yeni kullanıcı oluşturuldu: ${user.email} by ${req.user.email}`);

    res.status(201).json({
        success: true,
        message: 'Kullanıcı başarıyla oluşturuldu',
        data: user
    });
});

const updateUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new AppError('Kullanıcı bulunamadı', 404));
    }

    if (req.params.id === req.user._id.toString() && req.body.isActive === false) {
        return next(new AppError('Kendi hesabınızı deaktif edemezsiniz', 400));
    }

    const before = {
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive
    };

    const allowedFields = ['firstName', 'lastName', 'role', 'permissions', 'isActive'];
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            user[field] = req.body[field];
        }
    });

    await user.save({ validateBeforeSave: false });

    await AuditLog.log({
        action: 'USER_UPDATE',
        category: 'USER',
        user: req.user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        changes: {
            before,
            after: {
                role: user.role,
                permissions: user.permissions,
                isActive: user.isActive
            }
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 }
    });

    res.status(200).json({
        success: true,
        message: 'Kullanıcı güncellendi',
        data: user
    });
});

const deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new AppError('Kullanıcı bulunamadı', 404));
    }

    if (req.params.id === req.user._id.toString()) {
        return next(new AppError('Kendi hesabınızı silemezsiniz', 400));
    }

    user.isActive = false;
    user.activeSessions = [];
    await user.save({ validateBeforeSave: false });

    await AuditLog.log({
        action: 'USER_DELETE',
        category: 'USER',
        user: req.user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 },
        severity: 'HIGH'
    });

    res.status(200).json({
        success: true,
        message: 'Kullanıcı silindi'
    });
});

const resetUserPassword = asyncHandler(async (req, res, next) => {
    const { newPassword } = req.body;

    const user = await User.findById(req.params.id).select('+passwordHistory');

    if (!user) {
        return next(new AppError('Kullanıcı bulunamadı', 404));
    }

    user.password = newPassword;
    user.activeSessions = [];
    await user.save();

    await AuditLog.log({
        action: 'PASSWORD_RESET_COMPLETE',
        category: 'AUTH',
        user: req.user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        details: { resetByAdmin: true },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 },
        severity: 'HIGH'
    });

    res.status(200).json({
        success: true,
        message: 'Şifre sıfırlandı'
    });
});

const toggleUserLock = asyncHandler(async (req, res, next) => {
    const { lock } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new AppError('Kullanıcı bulunamadı', 404));
    }

    if (lock) {
        user.lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.loginAttempts = 5;
    } else {
        user.lockUntil = undefined;
        user.loginAttempts = 0;
    }

    await user.save({ validateBeforeSave: false });

    await AuditLog.log({
        action: lock ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED',
        category: 'SECURITY',
        user: req.user,
        resource: {
            type: 'User',
            id: user._id,
            identifier: user.email
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 },
        severity: 'HIGH'
    });

    res.status(200).json({
        success: true,
        message: lock ? 'Hesap kilitlendi' : 'Hesap kilidi açıldı'
    });
});

module.exports = {
    register,
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword,
    toggleUserLock
};