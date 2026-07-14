const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'LOGIN_SUCCESS',
            'LOGIN_FAILURE',
            'LOGOUT',
            'PASSWORD_CHANGE',
            'PASSWORD_RESET_REQUEST',
            'PASSWORD_RESET_COMPLETE',
            'MFA_ENABLED',
            'MFA_DISABLED',
            'ACCOUNT_LOCKED',
            'ACCOUNT_UNLOCKED',
            
            'USER_CREATE',
            'USER_UPDATE',
            'USER_DELETE',
            'USER_ROLE_CHANGE',
            'USER_PERMISSION_CHANGE',
            
            'STUDENT_CREATE',
            'STUDENT_UPDATE',
            'STUDENT_DELETE',
            'STUDENT_RESTORE',
            
            'RECORD_CREATE',
            'RECORD_UPDATE',
            'RECORD_DELETE',
            'RECORD_STATUS_CHANGE',
            'RECORD_APPROVE',
            'RECORD_REJECT',
            'APPEAL_SUBMIT',
            'APPEAL_DECIDE',
            
            'DATA_EXPORT',
            'DATA_IMPORT',
            'BULK_UPDATE',
            
            'SYSTEM_CONFIG_CHANGE',
            'BACKUP_CREATE',
            'BACKUP_RESTORE',
            
            'SUSPICIOUS_ACTIVITY',
            'RATE_LIMIT_EXCEEDED',
            'INJECTION_ATTEMPT',
            'UNAUTHORIZED_ACCESS'
        ],
        index: true
    },
    
    category: {
        type: String,
        required: true,
        enum: ['AUTH', 'USER', 'STUDENT', 'DISCIPLINARY', 'DATA', 'SYSTEM', 'SECURITY'],
        index: true
    },
    
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    
    userSnapshot: {
        email: String,
        fullName: String,
        role: String
    },
    
    resource: {
        type: {
            type: String,
            enum: ['User', 'Student', 'DisciplinaryRecord', 'System']
        },
        id: mongoose.Schema.Types.ObjectId,
        identifier: String // Örn: öğrenci numarası, email
    },
    
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed
    },
    
    request: {
        method: String,
        path: String,
        query: mongoose.Schema.Types.Mixed,
        body: mongoose.Schema.Types.Mixed, // Hassas veriler maskelenmiş
        requestId: String
    },
    
    client: {
        ipAddress: {
            type: String,
            required: true
        },
        userAgent: String,
        deviceType: String,
        browser: String,
        os: String,
        location: {
            country: String,
            city: String
        }
    },
    
    result: {
        success: {
            type: Boolean,
            required: true
        },
        statusCode: Number,
        errorMessage: String,
        errorStack: String // Sadece development'ta
    },
    
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW',
        index: true
    },
    
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        index: { expires: 0 }
    }

}, {
    timestamps: false, // Manuel timestamp kullanıyoruz
    collection: 'audit_logs',
    strict: true
});

auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });
auditLogSchema.index({ 'client.ipAddress': 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

auditLogSchema.pre('updateOne', function() {
    throw new Error('Audit logları güncellenemez');
});

auditLogSchema.pre('updateMany', function() {
    throw new Error('Audit logları güncellenemez');
});

auditLogSchema.pre('findOneAndUpdate', function() {
    throw new Error('Audit logları güncellenemez');
});

auditLogSchema.pre('deleteOne', function() {
});

auditLogSchema.statics.log = async function(data) {
    const { action, category, user, resource, details, changes, request, client, result, severity } = data;
    
    const maskedBody = maskSensitiveData(request?.body);
    
    const log = new this({
        action,
        category,
        user: user?._id || user,
        userSnapshot: user ? {
            email: user.email,
            fullName: user.fullName,
            role: user.role
        } : undefined,
        resource,
        details,
        changes: changes ? {
            before: maskSensitiveData(changes.before),
            after: maskSensitiveData(changes.after)
        } : undefined,
        request: request ? {
            method: request.method,
            path: request.path,
            query: request.query,
            body: maskedBody,
            requestId: request.requestId
        } : undefined,
        client,
        result,
        severity: severity || calculateSeverity(action, result?.success)
    });
    
    return log.save();
};

auditLogSchema.statics.getUserActivity = function(userId, options = {}) {
    const query = this.find({ user: userId });
    
    if (options.startDate) {
        query.where('timestamp').gte(options.startDate);
    }
    if (options.endDate) {
        query.where('timestamp').lte(options.endDate);
    }
    if (options.category) {
        query.where('category').equals(options.category);
    }
    
    return query.sort({ timestamp: -1 }).limit(options.limit || 100);
};

auditLogSchema.statics.getSecurityEvents = function(options = {}) {
    return this.find({
        $or: [
            { category: 'SECURITY' },
            { severity: { $in: ['HIGH', 'CRITICAL'] } },
            { 'result.success': false, action: { $in: ['LOGIN_FAILURE', 'UNAUTHORIZED_ACCESS'] } }
        ]
    })
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

auditLogSchema.statics.getStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    action: '$action',
                    category: '$category'
                },
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: ['$result.success', 1, 0] }
                },
                failureCount: {
                    $sum: { $cond: ['$result.success', 0, 1] }
                }
            }
        },
        {
            $sort: { count: -1 }
        }
    ]);
};

function maskSensitiveData(data) {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'token', 'secret', 'tcKimlik', 'phone', 'address'];
    const masked = { ...data };
    
    for (const field of sensitiveFields) {
        if (masked[field]) {
            masked[field] = '***MASKED***';
        }
    }
    
    return masked;
}

function calculateSeverity(action, success) {
    const criticalActions = ['ACCOUNT_LOCKED', 'INJECTION_ATTEMPT', 'UNAUTHORIZED_ACCESS'];
    const highActions = ['USER_DELETE', 'RECORD_DELETE', 'PASSWORD_RESET_COMPLETE', 'SUSPICIOUS_ACTIVITY'];
    const mediumActions = ['LOGIN_FAILURE', 'USER_ROLE_CHANGE', 'RECORD_STATUS_CHANGE'];
    
    if (criticalActions.includes(action)) return 'CRITICAL';
    if (highActions.includes(action)) return 'HIGH';
    if (mediumActions.includes(action) || !success) return 'MEDIUM';
    return 'LOW';
}

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
