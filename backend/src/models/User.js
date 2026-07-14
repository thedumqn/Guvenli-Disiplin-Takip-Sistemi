const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
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
    
    email: {
        type: String,
        required: [true, 'Email adresi zorunludur'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(v);
            },
            message: 'Geçersiz email adresi'
        }
    },
    
    password: {
        type: String,
        required: [true, 'Şifre zorunludur'],
        minlength: [12, 'Şifre en az 12 karakter olmalıdır'],
        select: false // Varsayılan olarak query'lerde gelmez
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
    
    role: {
        type: String,
        enum: {
            values: ['admin', 'kurul_uyesi', 'ogrenci_isleri', 'izleyici'],
            message: '{VALUE} geçerli bir rol değildir'
        },
        default: 'izleyici'
    },
    
    permissions: [{
        type: String,
        enum: [
            'create_record',      // Kayıt oluşturma
            'read_record',        // Kayıt görüntüleme
            'update_record',      // Kayıt güncelleme
            'delete_record',      // Kayıt silme
            'manage_users',       // Kullanıcı yönetimi
            'view_audit_logs',    // Audit loglarını görme
            'export_data',        // Veri dışa aktarma
            'manage_students'     // Öğrenci yönetimi
        ]
    }],
    
    passwordHistory: {
        type: [String],
        select: false,
        default: []
    },
    
    passwordChangedAt: Date,
    
    passwordResetToken: {
        type: String,
        select: false
    },
    
    passwordResetExpires: {
        type: Date,
        select: false
    },
    
    loginAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    
    lockUntil: {
        type: Date,
        select: false
    },
    
    activeSessions: [{
        sessionId: String,
        deviceInfo: String,
        ipAddress: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        lastActivity: Date
    }],
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    
    emailVerificationToken: {
        type: String,
        select: false
    },
    
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    
    mfaSecret: {
        type: String,
        select: false
    },
    
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    lastLogin: Date,
    
    lastLoginIP: String

}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.passwordHistory;
            delete ret.passwordResetToken;
            delete ret.passwordResetExpires;
            delete ret.loginAttempts;
            delete ret.lockUntil;
            delete ret.emailVerificationToken;
            delete ret.mfaSecret;
            delete ret.__v;
            return ret;
        }
    }
});

userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
        if (!passwordRegex.test(this.password)) {
            throw new Error('Şifre en az 12 karakter, bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir');
        }
        
        if (this.passwordHistory && this.passwordHistory.length > 0) {
            for (const oldHash of this.passwordHistory) {
                const isMatch = await bcrypt.compare(this.password, oldHash);
                if (isMatch) {
                    throw new Error('Bu şifre daha önce kullanılmış. Farklı bir şifre seçiniz.');
                }
            }
        }
        
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const hash = await bcrypt.hash(this.password, saltRounds);
        
        if (this.password !== this.passwordHistory?.[0]) {
            this.passwordHistory = this.passwordHistory || [];
            this.passwordHistory.unshift(hash);
            if (this.passwordHistory.length > 5) {
                this.passwordHistory = this.passwordHistory.slice(0, 5);
            }
        }
        
        this.password = hash;
        this.passwordChangedAt = new Date();
        
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    
    return resetToken; // Hashsiz versiyonu döndür
};

userSchema.methods.incLoginAttempts = async function() {
    const LOCK_TIME = 30 * 60 * 1000; // 30 dakika
    const MAX_ATTEMPTS = 5;
    
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + LOCK_TIME };
    }
    
    return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

userSchema.statics.findByEmailWithPassword = function(email) {
    return this.findOne({ email }).select('+password +loginAttempts +lockUntil');
};

userSchema.statics.findByRole = function(role) {
    return this.find({ role, isActive: true });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
