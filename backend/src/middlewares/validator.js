const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value ? '***' : undefined
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Geçersiz veri girişi',
            errors: errorMessages
        });
    }
    
    next();
};

const loginValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email adresi zorunludur')
        .isEmail().withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail()
        .isLength({ max: 100 }).withMessage('Email en fazla 100 karakter olabilir'),
    
    body('password')
        .notEmpty().withMessage('Şifre zorunludur')
        .isLength({ min: 1, max: 128 }).withMessage('Geçersiz şifre'),
    
    validate
];

const registerValidator = [
    body('tcKimlik')
        .trim()
        .notEmpty().withMessage('TC Kimlik numarası zorunludur')
        .isLength({ min: 11, max: 11 }).withMessage('TC Kimlik numarası 11 haneli olmalıdır')
        .isNumeric().withMessage('TC Kimlik numarası sadece rakamlardan oluşmalıdır'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email adresi zorunludur')
        .isEmail().withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail()
        .isLength({ max: 100 }).withMessage('Email en fazla 100 karakter olabilir'),
    
    body('password')
        .notEmpty().withMessage('Şifre zorunludur')
        .isLength({ min: 12, max: 128 }).withMessage('Şifre en az 12, en fazla 128 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'),
    
    body('passwordConfirm')
        .notEmpty().withMessage('Şifre tekrarı zorunludur')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Şifreler eşleşmiyor');
            }
            return true;
        }),
    
    body('firstName')
        .trim()
        .notEmpty().withMessage('Ad zorunludur')
        .isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Ad sadece harflerden oluşmalıdır'),
    
    body('lastName')
        .trim()
        .notEmpty().withMessage('Soyad zorunludur')
        .isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Soyad sadece harflerden oluşmalıdır'),
    
    validate
];

const changePasswordValidator = [
    body('currentPassword')
        .notEmpty().withMessage('Mevcut şifre zorunludur'),
    
    body('newPassword')
        .notEmpty().withMessage('Yeni şifre zorunludur')
        .isLength({ min: 12, max: 128 }).withMessage('Şifre en az 12, en fazla 128 karakter olmalıdır')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('Yeni şifre mevcut şifreyle aynı olamaz');
            }
            return true;
        }),
    
    body('newPasswordConfirm')
        .notEmpty().withMessage('Şifre tekrarı zorunludur')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Şifreler eşleşmiyor');
            }
            return true;
        }),
    
    validate
];

const createStudentValidator = [
    body('studentNumber')
        .trim()
        .notEmpty().withMessage('Öğrenci numarası zorunludur')
        .isLength({ min: 9, max: 11 }).withMessage('Öğrenci numarası 9-11 haneli olmalıdır')
        .isNumeric().withMessage('Öğrenci numarası sadece rakamlardan oluşmalıdır'),
    
    body('tcKimlik')
        .trim()
        .notEmpty().withMessage('TC Kimlik numarası zorunludur')
        .isLength({ min: 11, max: 11 }).withMessage('TC Kimlik numarası 11 haneli olmalıdır')
        .isNumeric().withMessage('TC Kimlik numarası sadece rakamlardan oluşmalıdır'),
    
    body('firstName')
        .trim()
        .notEmpty().withMessage('Ad zorunludur')
        .isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Ad sadece harflerden oluşmalıdır'),
    
    body('lastName')
        .trim()
        .notEmpty().withMessage('Soyad zorunludur')
        .isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Soyad sadece harflerden oluşmalıdır'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email adresi zorunludur')
        .isEmail().withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail(),
    
    body('faculty')
        .trim()
        .notEmpty().withMessage('Fakülte zorunludur')
        .isLength({ max: 100 }).withMessage('Fakülte en fazla 100 karakter olabilir'),
    
    body('department')
        .trim()
        .notEmpty().withMessage('Bölüm zorunludur')
        .isLength({ max: 100 }).withMessage('Bölüm en fazla 100 karakter olabilir'),
    
    body('grade')
        .notEmpty().withMessage('Sınıf zorunludur')
        .isInt({ min: 1, max: 6 }).withMessage('Sınıf 1-6 arasında olmalıdır'),
    
    body('enrollmentYear')
        .notEmpty().withMessage('Kayıt yılı zorunludur')
        .isInt({ min: 1990, max: new Date().getFullYear() })
        .withMessage('Geçerli bir kayıt yılı giriniz'),
    
    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s()]+$/).withMessage('Geçerli bir telefon numarası giriniz'),
    
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Adres en fazla 500 karakter olabilir'),
    
    validate
];

const updateStudentValidator = [
    param('id')
        .isMongoId().withMessage('Geçersiz öğrenci ID'),
    
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Ad sadece harflerden oluşmalıdır'),
    
    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Soyad 2-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Soyad sadece harflerden oluşmalıdır'),
    
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Geçerli bir email adresi giriniz')
        .normalizeEmail(),
    
    body('status')
        .optional()
        .isIn(['aktif', 'pasif', 'mezun', 'kayit_dondurmus', 'ilisik_kesilmis'])
        .withMessage('Geçersiz durum'),
    
    validate
];

const createDisciplinaryRecordValidator = [
    body('student')
        .notEmpty().withMessage('Öğrenci bilgisi zorunludur')
        .isMongoId().withMessage('Geçersiz öğrenci ID'),
    
    body('incidentDate')
        .notEmpty().withMessage('Olay tarihi zorunludur')
        .isISO8601().withMessage('Geçerli bir tarih formatı giriniz')
        .custom((value) => {
            if (new Date(value) > new Date()) {
                throw new Error('Olay tarihi gelecekte olamaz');
            }
            return true;
        }),
    
    body('incidentLocation')
        .trim()
        .notEmpty().withMessage('Olay yeri zorunludur')
        .isLength({ max: 200 }).withMessage('Olay yeri en fazla 200 karakter olabilir'),
    
    body('incidentDescription')
        .trim()
        .notEmpty().withMessage('Olay açıklaması zorunludur')
        .isLength({ min: 10, max: 5000 }).withMessage('Olay açıklaması 10-5000 karakter arasında olmalıdır'),
    
    body('violatedArticle')
        .trim()
        .notEmpty().withMessage('İhlal edilen madde zorunludur')
        .isLength({ max: 200 }).withMessage('İhlal edilen madde en fazla 200 karakter olabilir'),
    
    body('penaltyType')
        .notEmpty().withMessage('Ceza türü zorunludur')
        .isIn(['uyari', 'kinama', 'uzaklastirma_1_hafta', 'uzaklastirma_2_hafta', 
               'uzaklastirma_1_ay', 'uzaklastirma_1_donem', 'uzaklastirma_2_donem', 'cikarma'])
        .withMessage('Geçersiz ceza türü'),
    
    body('decisionNumber')
        .trim()
        .notEmpty().withMessage('Karar numarası zorunludur')
        .isLength({ max: 50 }).withMessage('Karar numarası en fazla 50 karakter olabilir'),
    
    body('decisionDate')
        .notEmpty().withMessage('Karar tarihi zorunludur')
        .isISO8601().withMessage('Geçerli bir tarih formatı giriniz'),
    
    body('decisionBody')
        .notEmpty().withMessage('Karar organı zorunludur')
        .isIn(['fakulte_yonetim_kurulu', 'universite_yonetim_kurulu', 'disiplin_kurulu'])
        .withMessage('Geçersiz karar organı'),
    
    body('penaltyStartDate')
        .optional()
        .isISO8601().withMessage('Geçerli bir tarih formatı giriniz'),
    
    body('penaltyEndDate')
        .optional()
        .isISO8601().withMessage('Geçerli bir tarih formatı giriniz')
        .custom((value, { req }) => {
            if (req.body.penaltyStartDate && new Date(value) < new Date(req.body.penaltyStartDate)) {
                throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz');
            }
            return true;
        }),
    
    body('internalNotes')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('İç not en fazla 2000 karakter olabilir'),
    
    validate
];

const updateDisciplinaryRecordValidator = [
    param('id')
        .isMongoId().withMessage('Geçersiz kayıt ID'),
    
    body('incidentDate')
        .optional()
        .isISO8601().withMessage('Geçerli bir tarih formatı giriniz'),
    
    body('incidentLocation')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Olay yeri en fazla 200 karakter olabilir'),
    
    body('incidentDescription')
        .optional()
        .trim()
        .isLength({ min: 10, max: 5000 }).withMessage('Olay açıklaması 10-5000 karakter arasında olmalıdır'),
    
    body('status')
        .optional()
        .isIn(['taslak', 'beklemede', 'onaylandi', 'itiraz_edildi', 'iptal_edildi', 'tamamlandi'])
        .withMessage('Geçersiz durum'),
    
    validate
];

const mongoIdValidator = [
    param('id')
        .isMongoId().withMessage('Geçersiz ID formatı'),
    validate
];

const paginationValidator = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Sayfa numarası pozitif bir sayı olmalıdır'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit 1-100 arasında olmalıdır'),
    
    query('sort')
        .optional()
        .matches(/^-?[a-zA-Z_]+$/).withMessage('Geçersiz sıralama parametresi'),
    
    validate
];

const sanitizeInput = (value) => {
    if (typeof value !== 'string') return value;
    
    return value
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

module.exports = {
    validate,
    loginValidator,
    registerValidator,
    changePasswordValidator,
    createStudentValidator,
    updateStudentValidator,
    createDisciplinaryRecordValidator,
    updateDisciplinaryRecordValidator,
    mongoIdValidator,
    paginationValidator,
    sanitizeInput
};
