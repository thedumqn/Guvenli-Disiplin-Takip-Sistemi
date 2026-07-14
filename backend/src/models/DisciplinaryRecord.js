const mongoose = require('mongoose');

const PENALTY_TYPES = {
    uyari: {
        name: 'Uyarı',
        description: 'Yazılı uyarı cezası',
        severity: 1
    },
    kinama: {
        name: 'Kınama',
        description: 'Kınama cezası',
        severity: 2
    },
    uzaklastirma_1_hafta: {
        name: '1 Hafta Uzaklaştırma',
        description: 'Yükseköğretim kurumundan 1 hafta uzaklaştırma',
        severity: 3
    },
    uzaklastirma_2_hafta: {
        name: '2 Hafta Uzaklaştırma',
        description: 'Yükseköğretim kurumundan 2 hafta uzaklaştırma',
        severity: 4
    },
    uzaklastirma_1_ay: {
        name: '1 Ay Uzaklaştırma',
        description: 'Yükseköğretim kurumundan 1 ay uzaklaştırma',
        severity: 5
    },
    uzaklastirma_1_donem: {
        name: '1 Dönem Uzaklaştırma',
        description: 'Yükseköğretim kurumundan 1 dönem uzaklaştırma',
        severity: 6
    },
    uzaklastirma_2_donem: {
        name: '2 Dönem Uzaklaştırma',
        description: 'Yükseköğretim kurumundan 2 dönem uzaklaştırma',
        severity: 7
    },
    cikarma: {
        name: 'Yükseköğretim Kurumundan Çıkarma',
        description: 'Yükseköğretim kurumundan çıkarma cezası',
        severity: 8
    }
};

const disciplinaryRecordSchema = new mongoose.Schema({
    recordNumber: {
        type: String,
        unique: true
    },
    
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'Öğrenci bilgisi zorunludur'],
        index: true
    },
    
    incidentDate: {
        type: Date,
        required: [true, 'Olay tarihi zorunludur']
    },
    
    incidentLocation: {
        type: String,
        required: [true, 'Olay yeri zorunludur'],
        trim: true,
        maxlength: [200, 'Olay yeri en fazla 200 karakter olabilir']
    },
    
    incidentDescription: {
        type: String,
        required: [true, 'Olay açıklaması zorunludur'],
        trim: true,
        maxlength: [5000, 'Olay açıklaması en fazla 5000 karakter olabilir']
    },
    
    violatedArticle: {
        type: String,
        required: [true, 'İhlal edilen madde zorunludur'],
        trim: true
    },
    
    penaltyType: {
        type: String,
        enum: Object.keys(PENALTY_TYPES),
        required: [true, 'Ceza türü zorunludur']
    },
    
    penaltyStartDate: Date,
    penaltyEndDate: Date,
    
    decisionNumber: {
        type: String,
        required: [true, 'Karar numarası zorunludur'],
        trim: true
    },
    
    decisionDate: {
        type: Date,
        required: [true, 'Karar tarihi zorunludur']
    },
    
    decisionBody: {
        type: String,
        required: [true, 'Karar organı zorunludur'],
        enum: ['fakulte_yonetim_kurulu', 'universite_yonetim_kurulu', 'disiplin_kurulu'],
        default: 'fakulte_yonetim_kurulu'
    },
    
    status: {
        type: String,
        enum: ['taslak', 'beklemede', 'onaylandi', 'itiraz_edildi', 'iptal_edildi', 'tamamlandi'],
        default: 'taslak'
    },
    
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        reason: String,
        _id: false
    }],
    
    appeal: {
        hasAppeal: {
            type: Boolean,
            default: false
        },
        appealDate: Date,
        appealReason: String,
        appealStatus: {
            type: String,
            enum: ['beklemede', 'kabul_edildi', 'reddedildi'],
        },
        appealDecisionDate: Date,
        appealDecisionNote: String
    },
    
    attachments: [{
        fileName: {
            type: String,
            required: true
        },
        originalName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true,
            enum: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        },
        size: {
            type: Number,
            max: [10485760, 'Dosya boyutu en fazla 10MB olabilir'] // 10MB
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        checksum: String // Dosya bütünlüğü için
    }],
    
    internalNotes: {
        type: String,
        maxlength: [2000, 'İç not en fazla 2000 karakter olabilir']
    },
    
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

disciplinaryRecordSchema.index({ student: 1, createdAt: -1 });
disciplinaryRecordSchema.index({ status: 1 });
disciplinaryRecordSchema.index({ penaltyType: 1 });
disciplinaryRecordSchema.index({ incidentDate: -1 });
disciplinaryRecordSchema.index({ decisionDate: -1 });
disciplinaryRecordSchema.index({ isDeleted: 1 });
disciplinaryRecordSchema.index({ 'statusHistory.changedAt': -1 });

disciplinaryRecordSchema.virtual('penaltyDetails').get(function() {
    return PENALTY_TYPES[this.penaltyType] || null;
});

disciplinaryRecordSchema.virtual('penaltyDuration').get(function() {
    if (this.penaltyStartDate && this.penaltyEndDate) {
        const diff = this.penaltyEndDate - this.penaltyStartDate;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    return null;
});

disciplinaryRecordSchema.pre(/^find/, function(next) {
    if (this.getQuery().includeDeleted !== true) {
        this.where({ isDeleted: false });
    }
    delete this.getQuery().includeDeleted;
    next();
});

disciplinaryRecordSchema.pre('save', async function(next) {
    if (this.isNew && !this.recordNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('DisciplinaryRecord').countDocuments({
            createdAt: {
                $gte: new Date(year, 0, 1),
                $lt: new Date(year + 1, 0, 1)
            }
        });
        this.recordNumber = `DIS-${year}-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

disciplinaryRecordSchema.pre('save', function(next) {
    if (this.isModified('status')) {
    }
    next();
});

disciplinaryRecordSchema.post('save', async function(doc) {
    if (doc.status === 'onaylandi' || doc.status === 'tamamlandi') {
        const Student = mongoose.model('Student');
        const student = await Student.findById(doc.student);
        
        if (student) {
            const DisciplinaryRecord = mongoose.model('DisciplinaryRecord');
            const records = await DisciplinaryRecord.find({
                student: doc.student,
                status: { $in: ['onaylandi', 'tamamlandi'] },
                isDeleted: false
            });
            
            student.disciplinaryStats = {
                totalRecords: records.length,
                warningCount: records.filter(r => r.penaltyType === 'uyari').length,
                reprimandCount: records.filter(r => r.penaltyType === 'kinama').length,
                suspensionCount: records.filter(r => r.penaltyType.startsWith('uzaklastirma')).length,
                expulsionCount: records.filter(r => r.penaltyType === 'cikarma').length
            };
            
            await student.save();
        }
    }
});

disciplinaryRecordSchema.statics.getPenaltyTypes = function() {
    return PENALTY_TYPES;
};

disciplinaryRecordSchema.statics.findByStudent = function(studentId, options = {}) {
    const query = this.find({ student: studentId });
    
    if (options.status) {
        query.where('status').equals(options.status);
    }
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ createdAt: -1 });
    }
    
    return query;
};

disciplinaryRecordSchema.methods.updateStatus = async function(newStatus, userId, reason = '') {
    this.statusHistory.push({
        status: newStatus,
        changedBy: userId,
        reason
    });
    this.status = newStatus;
    this.updatedBy = userId;
    return this.save();
};

disciplinaryRecordSchema.methods.softDelete = async function(userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
};

const DisciplinaryRecord = mongoose.model('DisciplinaryRecord', disciplinaryRecordSchema);

module.exports = DisciplinaryRecord;
