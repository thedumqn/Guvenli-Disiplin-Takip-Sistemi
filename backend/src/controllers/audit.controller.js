const { AuditLog } = require('../models');
const { asyncHandler } = require('../middlewares/errorHandler');

const getAuditLogs = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.user) filter.user = req.query.user;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.success !== undefined) filter['result.success'] = req.query.success === 'true';
    
    if (req.query.startDate || req.query.endDate) {
        filter.timestamp = {};
        if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
        if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
    }
    
    if (req.query.ip) {
        filter['client.ipAddress'] = req.query.ip;
    }
    
    const logs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName email');
    
    const total = await AuditLog.countDocuments(filter);
    
    res.status(200).json({
        success: true,
        data: logs,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

const getAuditLog = asyncHandler(async (req, res, next) => {
    const log = await AuditLog.findById(req.params.id)
        .populate('user', 'firstName lastName email role');
    
    if (!log) {
        return res.status(404).json({
            success: false,
            message: 'Log bulunamadı'
        });
    }
    
    res.status(200).json({
        success: true,
        data: log
    });
});

const getUserActivity = asyncHandler(async (req, res, next) => {
    const { startDate, endDate, category } = req.query;
    
    const options = {
        limit: parseInt(req.query.limit) || 100
    };
    
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (category) options.category = category;
    
    const logs = await AuditLog.getUserActivity(req.params.userId, options);
    
    res.status(200).json({
        success: true,
        data: logs
    });
});

const getSecurityEvents = asyncHandler(async (req, res, next) => {
    const options = {
        limit: parseInt(req.query.limit) || 100
    };
    
    const logs = await AuditLog.getSecurityEvents(options);
    
    res.status(200).json({
        success: true,
        data: logs
    });
});

const getAuditStats = asyncHandler(async (req, res, next) => {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await AuditLog.getStats(start, end);
    
    const summary = await AuditLog.aggregate([
        {
            $match: {
                timestamp: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                successCount: {
                    $sum: { $cond: ['$result.success', 1, 0] }
                },
                failureCount: {
                    $sum: { $cond: ['$result.success', 0, 1] }
                },
                uniqueUsers: { $addToSet: '$user' },
                uniqueIPs: { $addToSet: '$client.ipAddress' }
            }
        },
        {
            $project: {
                totalLogs: 1,
                successCount: 1,
                failureCount: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
                uniqueIPs: { $size: '$uniqueIPs' }
            }
        }
    ]);
    
    const dailyTrend = await AuditLog.aggregate([
        {
            $match: {
                timestamp: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
        success: true,
        data: {
            summary: summary[0] || {
                totalLogs: 0,
                successCount: 0,
                failureCount: 0,
                uniqueUsers: 0,
                uniqueIPs: 0
            },
            byAction: stats,
            dailyTrend
        }
    });
});

const getFailedLogins = asyncHandler(async (req, res, next) => {
    const { hours = 24 } = req.query;
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const logs = await AuditLog.find({
        action: 'LOGIN_FAILURE',
        timestamp: { $gte: since }
    })
    .sort({ timestamp: -1 })
    .limit(100);
    
    const byIP = await AuditLog.aggregate([
        {
            $match: {
                action: 'LOGIN_FAILURE',
                timestamp: { $gte: since }
            }
        },
        {
            $group: {
                _id: '$client.ipAddress',
                count: { $sum: 1 },
                lastAttempt: { $max: '$timestamp' }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
    ]);
    
    res.status(200).json({
        success: true,
        data: {
            logs,
            byIP,
            period: `Son ${hours} saat`
        }
    });
});

const getResourceLogs = asyncHandler(async (req, res, next) => {
    const { type, id } = req.params;
    
    const logs = await AuditLog.find({
        'resource.type': type,
        'resource.id': id
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .populate('user', 'firstName lastName email');
    
    res.status(200).json({
        success: true,
        data: logs
    });
});

const getActionTypes = asyncHandler(async (req, res, next) => {
    const actions = await AuditLog.distinct('action');
    const categories = await AuditLog.distinct('category');
    
    res.status(200).json({
        success: true,
        data: {
            actions,
            categories
        }
    });
});

module.exports = {
    getAuditLogs,
    getAuditLog,
    getUserActivity,
    getSecurityEvents,
    getAuditStats,
    getFailedLogins,
    getResourceLogs,
    getActionTypes
};
