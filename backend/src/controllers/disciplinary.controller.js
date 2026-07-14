const { DisciplinaryRecord, Student, AuditLog } = require('../models');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const getRecords = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.penaltyType) filter.penaltyType = req.query.penaltyType;
    if (req.query.student) filter.student = req.query.student;
    if (req.query.decisionBody) filter.decisionBody = req.query.decisionBody;
    
    if (req.query.startDate || req.query.endDate) {
        filter.incidentDate = {};
        if (req.query.startDate) filter.incidentDate.$gte = new Date(req.query.startDate);
        if (req.query.endDate) filter.incidentDate.$lte = new Date(req.query.endDate);
    }
    
    const sort = req.query.sort || '-createdAt';
    
    const records = await DisciplinaryRecord.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('student', 'studentNumber firstName lastName faculty department')
        .populate('createdBy', 'firstName lastName email');
    
    const total = await DisciplinaryRecord.countDocuments(filter);
    
    res.status(200).json({
        success: true,
        data: records,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

const getRecord = asyncHandler(async (req, res, next) => {
    const record = await DisciplinaryRecord.findById(req.params.id)
        .populate('student', 'studentNumber firstName lastName email faculty department grade')
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .populate('statusHistory.changedBy', 'firstName lastName email');
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    res.status(200).json({
        success: true,
        data: record
    });
});

const createRecord = asyncHandler(async (req, res, next) => {
    const {
        student, incidentDate, incidentLocation, incidentDescription,
        violatedArticle, penaltyType, penaltyStartDate, penaltyEndDate,
        decisionNumber, decisionDate, decisionBody, internalNotes
    } = req.body;
    
    const studentDoc = await Student.findById(student);
    if (!studentDoc) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    const record = await DisciplinaryRecord.create({
        student,
        incidentDate,
        incidentLocation,
        incidentDescription,
        violatedArticle,
        penaltyType,
        penaltyStartDate,
        penaltyEndDate,
        decisionNumber,
        decisionDate,
        decisionBody,
        internalNotes,
        status: 'taslak',
        statusHistory: [{
            status: 'taslak',
            changedBy: req.user._id,
            reason: 'Kayıt oluşturuldu'
        }],
        createdBy: req.user._id
    });
    
    await AuditLog.log({
        action: 'RECORD_CREATE',
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
        },
        details: {
            recordNumber: record.recordNumber,
            studentNumber: studentDoc.studentNumber,
            penaltyType: record.penaltyType
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 201 }
    });
    
    logger.info(`Yeni disiplin kaydı: ${record.recordNumber} by ${req.user.email}`);
    
    res.status(201).json({
        success: true,
        message: 'Disiplin kaydı başarıyla oluşturuldu',
        data: record
    });
});

const updateRecord = asyncHandler(async (req, res, next) => {
    const record = await DisciplinaryRecord.findById(req.params.id);
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    if (['onaylandi', 'tamamlandi'].includes(record.status)) {
        return next(new AppError('Onaylanmış kayıtlar düzenlenemez', 400));
    }
    
    const before = {
        incidentDate: record.incidentDate,
        incidentLocation: record.incidentLocation,
        incidentDescription: record.incidentDescription,
        violatedArticle: record.violatedArticle,
        penaltyType: record.penaltyType
    };
    
    const allowedFields = [
        'incidentDate', 'incidentLocation', 'incidentDescription',
        'violatedArticle', 'penaltyType', 'penaltyStartDate', 'penaltyEndDate',
        'decisionNumber', 'decisionDate', 'decisionBody', 'internalNotes'
    ];
    
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            record[field] = req.body[field];
        }
    });
    
    record.updatedBy = req.user._id;
    await record.save();
    
    await AuditLog.log({
        action: 'RECORD_UPDATE',
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
        },
        changes: {
            before,
            after: {
                incidentDate: record.incidentDate,
                incidentLocation: record.incidentLocation,
                incidentDescription: record.incidentDescription,
                violatedArticle: record.violatedArticle,
                penaltyType: record.penaltyType
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
        message: 'Disiplin kaydı başarıyla güncellendi',
        data: record
    });
});

const updateRecordStatus = asyncHandler(async (req, res, next) => {
    const { status, reason } = req.body;
    
    const record = await DisciplinaryRecord.findById(req.params.id);
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    const validTransitions = {
        'taslak': ['beklemede', 'iptal_edildi'],
        'beklemede': ['onaylandi', 'iptal_edildi', 'taslak'],
        'onaylandi': ['itiraz_edildi', 'tamamlandi'],
        'itiraz_edildi': ['onaylandi', 'iptal_edildi'],
        'iptal_edildi': [],
        'tamamlandi': []
    };
    
    if (!validTransitions[record.status]?.includes(status)) {
        return next(new AppError(
            `${record.status} durumundan ${status} durumuna geçiş yapılamaz`,
            400
        ));
    }
    
    const previousStatus = record.status;
    
    await record.updateStatus(status, req.user._id, reason);
    
    let action = 'RECORD_STATUS_CHANGE';
    if (status === 'onaylandi') action = 'RECORD_APPROVE';
    if (status === 'iptal_edildi') action = 'RECORD_REJECT';
    
    await AuditLog.log({
        action,
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
        },
        details: {
            previousStatus,
            newStatus: status,
            reason
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
        message: 'Kayıt durumu güncellendi',
        data: record
    });
});

const submitAppeal = asyncHandler(async (req, res, next) => {
    const { appealReason } = req.body;
    
    const record = await DisciplinaryRecord.findById(req.params.id);
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    if (record.status !== 'onaylandi') {
        return next(new AppError('Sadece onaylanmış kayıtlara itiraz edilebilir', 400));
    }
    
    if (record.appeal?.hasAppeal) {
        return next(new AppError('Bu kayıt için zaten itiraz yapılmış', 400));
    }
    
    record.appeal = {
        hasAppeal: true,
        appealDate: new Date(),
        appealReason,
        appealStatus: 'beklemede'
    };
    
    await record.updateStatus('itiraz_edildi', req.user._id, 'İtiraz başvurusu yapıldı');
    
    await AuditLog.log({
        action: 'APPEAL_SUBMIT',
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
        },
        details: { appealReason },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 }
    });
    
    res.status(200).json({
        success: true,
        message: 'İtiraz başvurusu kaydedildi',
        data: record
    });
});

const decideAppeal = asyncHandler(async (req, res, next) => {
    const { appealStatus, appealDecisionNote } = req.body;
    
    if (!['kabul_edildi', 'reddedildi'].includes(appealStatus)) {
        return next(new AppError('Geçersiz itiraz durumu', 400));
    }
    
    const record = await DisciplinaryRecord.findById(req.params.id);
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    if (!record.appeal?.hasAppeal || record.appeal.appealStatus !== 'beklemede') {
        return next(new AppError('Bekleyen itiraz bulunamadı', 400));
    }
    
    record.appeal.appealStatus = appealStatus;
    record.appeal.appealDecisionDate = new Date();
    record.appeal.appealDecisionNote = appealDecisionNote;
    
    const newStatus = appealStatus === 'kabul_edildi' ? 'iptal_edildi' : 'onaylandi';
    await record.updateStatus(newStatus, req.user._id, `İtiraz ${appealStatus}`);
    
    await AuditLog.log({
        action: 'APPEAL_DECIDE',
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
        },
        details: {
            appealStatus,
            appealDecisionNote,
            newRecordStatus: newStatus
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
        message: 'İtiraz kararı kaydedildi',
        data: record
    });
});

const deleteRecord = asyncHandler(async (req, res, next) => {
    const record = await DisciplinaryRecord.findById(req.params.id);
    
    if (!record) {
        return next(new AppError('Disiplin kaydı bulunamadı', 404));
    }
    
    if (['onaylandi', 'tamamlandi'].includes(record.status)) {
        return next(new AppError('Onaylanmış kayıtlar silinemez', 400));
    }
    
    await record.softDelete(req.user._id);
    
    await AuditLog.log({
        action: 'RECORD_DELETE',
        category: 'DISCIPLINARY',
        user: req.user,
        resource: {
            type: 'DisciplinaryRecord',
            id: record._id,
            identifier: record.recordNumber
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
        message: 'Disiplin kaydı silindi'
    });
});

const getPenaltyTypes = asyncHandler(async (req, res, next) => {
    const penaltyTypes = DisciplinaryRecord.getPenaltyTypes();
    
    res.status(200).json({
        success: true,
        data: penaltyTypes
    });
});

const getStats = asyncHandler(async (req, res, next) => {
    const { startDate, endDate } = req.query;
    
    const matchFilter = { isDeleted: false };
    
    if (startDate || endDate) {
        matchFilter.createdAt = {};
        if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
        if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    
    const [
        totalRecords,
        byStatus,
        byPenaltyType,
        byDecisionBody,
        monthlyTrend
    ] = await Promise.all([
        DisciplinaryRecord.countDocuments(matchFilter),
        
        DisciplinaryRecord.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        
        DisciplinaryRecord.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$penaltyType', count: { $sum: 1 } } }
        ]),
        
        DisciplinaryRecord.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$decisionBody', count: { $sum: 1 } } }
        ]),
        
        DisciplinaryRecord.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ])
    ]);
    
    res.status(200).json({
        success: true,
        data: {
            totalRecords,
            byStatus: byStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            byPenaltyType: byPenaltyType.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            byDecisionBody: byDecisionBody.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            monthlyTrend: monthlyTrend.map(item => ({
                year: item._id.year,
                month: item._id.month,
                count: item.count
            }))
        }
    });
});

module.exports = {
    getRecords,
    getRecord,
    createRecord,
    updateRecord,
    updateRecordStatus,
    submitAppeal,
    decideAppeal,
    deleteRecord,
    getPenaltyTypes,
    getStats
};
