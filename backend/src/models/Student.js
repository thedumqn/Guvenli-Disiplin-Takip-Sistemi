const mongoose = require('mongoose');
const crypto = require('crypto');

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const getEncryptionKey = () => {
    const key = Buffer.from(process.env.DB_ENCRYPTION_KEY || '', 'hex');
    if (key.length !== 32) {
        throw new Error('DB_ENCRYPTION_KEY 64 karakterlik hex bir deger olmalidir (openssl rand -hex 32)');
    }
    return key;
};

const encrypt = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
};

const decrypt = (payload) => {
    if (!payload) return payload;
    try {
        const data = Buffer.from(payload, 'base64');
        const iv = data.subarray(0, IV_LENGTH);
        const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
        return null;
    }
};

const studentSchema = new mongoose.Schema({
    studentNumber: {
        type: String,
        required: [true, 'Öğrenci numarası zorunludur'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^\d{9,11}$/.test(v);
            },
            message: 'Öğrenci numarası 9-11 haneli olmalıdır'
        }
    },
    
    tcKimlik: {
        type: String,
        required: [true, 'TC Kimlik numarası zorunludur'],
        unique: true,
        validate: {
            validator: function(v) {
                if (!/^\d{11}$/.test(v)) return false;
                if (v[0] === '0') return false;
                
                const digits = v.split('').map(Number);
                const sum1 = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
                const sum2 = digits[1] + digits[3] + digits[5] + digits[7];
                
                const check1 = ((sum1 * 7) - sum2) % 10;
                const check2 = (sum1 + sum2 + digits[9]) % 10;
                
                return check1 === digits[9] && check2 === digits[10];
            },
            message: 'Geçersiz TC Kimlik numarası'
        }
    },
    
    firstName: {
        type: String,
        required: [true, 'Ad zorunludur'],
        trim: true,
        maxlength: [50, 'Ad en fazla 50 karakter olabilir']
    },
    
    lastName: {
        type: String,
        required: [true, 'Soyad zorunludur'],
        trim: true,
        maxlength: [50, 'Soyad en fazla 50 karakter olabilir']
    },
    
    email: {
        type: String,
        required: [true, 'Email adresi zorunludur'],
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Geçersiz email adresi'
        }
    },
    
    phone: {
        type: String,
        set: encrypt,
        get: decrypt
    },
    
    address: {
        type: String,
        set: encrypt,
        get: decrypt
    },
    
    faculty: {
        type: String,
        required: [true, 'Fakülte zorunludur'],
        trim: true
    },
    
    department: {
        type: String,
        required: [true, 'Bölüm zorunludur'],
        trim: true
    },
    
    grade: {
        type: Number,
        required: [true, 'Sınıf zorunludur'],
        min: [1, 'Sınıf en az 1 olabilir'],
        max: [6, 'Sınıf en fazla 6 olabilir']
    },
    
    enrollmentYear: {
        type: Number,
        required: [true, 'Kayıt yılı zorunludur']
    },
    
    status: {
        type: String,
        enum: ['aktif', 'pasif', 'mezun', 'kayit_dondurmus', 'ilisik_kesilmis'],
        default: 'aktif'
    },
    
    disciplinaryStats: {
        totalRecords: { type: Number, default: 0 },
        warningCount: { type: Number, default: 0 },
        reprimandCount: { type: Number, default: 0 },
        suspensionCount: { type: Number, default: 0 },
        expulsionCount: { type: Number, default: 0 }
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
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
});

studentSchema.index({ faculty: 1, department: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ isDeleted: 1 });
studentSchema.index({ lastName: 'text', firstName: 'text' }); // Full-text search

studentSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

studentSchema.virtual('disciplinaryRecords', {
    ref: 'DisciplinaryRecord',
    localField: '_id',
    foreignField: 'student'
});

studentSchema.pre(/^find/, function(next) {
    if (this.getQuery().includeDeleted !== true) {
        this.where({ isDeleted: false });
    }
    delete this.getQuery().includeDeleted;
    next();
});

studentSchema.pre('save', function(next) {
    if (this.isNew) {
        this.disciplinaryStats = {
            totalRecords: 0,
            warningCount: 0,
            reprimandCount: 0,
            suspensionCount: 0,
            expulsionCount: 0
        };
    }
    next();
});

studentSchema.statics.findActive = function() {
    return this.find({ status: 'aktif', isDeleted: false });
};

studentSchema.statics.findByFaculty = function(faculty) {
    return this.find({ faculty, isDeleted: false });
};

studentSchema.methods.softDelete = async function(userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
};

studentSchema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    return this.save();
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
