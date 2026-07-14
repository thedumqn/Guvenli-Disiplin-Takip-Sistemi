const { Student, DisciplinaryRecord, AuditLog } = require('../models');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const getStudents = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.faculty) filter.faculty = req.query.faculty;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.grade) filter.grade = parseInt(req.query.grade);
    
    if (req.query.search) {
        filter.$or = [
            { firstName: { $regex: req.query.search, $options: 'i' } },
            { lastName: { $regex: req.query.search, $options: 'i' } },
            { studentNumber: { $regex: req.query.search, $options: 'i' } }
        ];
    }
    
    const sort = req.query.sort || '-createdAt';
    
    const students = await Student.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email');
    
    const total = await Student.countDocuments(filter);
    
    res.status(200).json({
        success: true,
        data: students,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

const getStudent = asyncHandler(async (req, res, next) => {
    const student = await Student.findById(req.params.id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email');
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    res.status(200).json({
        success: true,
        data: student
    });
});

const getStudentByNumber = asyncHandler(async (req, res, next) => {
    const student = await Student.findOne({ studentNumber: req.params.studentNumber });
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    res.status(200).json({
        success: true,
        data: student
    });
});

const createStudent = asyncHandler(async (req, res, next) => {
    const {
        studentNumber, tcKimlik, firstName, lastName, email,
        faculty, department, grade, enrollmentYear, phone, address
    } = req.body;
    
    const student = await Student.create({
        studentNumber,
        tcKimlik,
        firstName,
        lastName,
        email,
        faculty,
        department,
        grade,
        enrollmentYear,
        phone,
        address,
        createdBy: req.user._id
    });
    
    await AuditLog.log({
        action: 'STUDENT_CREATE',
        category: 'STUDENT',
        user: req.user,
        resource: {
            type: 'Student',
            id: student._id,
            identifier: student.studentNumber
        },
        details: {
            studentNumber: student.studentNumber,
            fullName: student.fullName
        },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 201 }
    });
    
    logger.info(`Yeni öğrenci oluşturuldu: ${student.studentNumber} by ${req.user.email}`);
    
    res.status(201).json({
        success: true,
        message: 'Öğrenci başarıyla oluşturuldu',
        data: student
    });
});

const updateStudent = asyncHandler(async (req, res, next) => {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    const before = {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        faculty: student.faculty,
        department: student.department,
        grade: student.grade,
        status: student.status
    };
    
    const allowedFields = [
        'firstName', 'lastName', 'email', 'phone', 'address',
        'faculty', 'department', 'grade', 'status'
    ];
    
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            student[field] = req.body[field];
        }
    });
    
    student.updatedBy = req.user._id;
    await student.save();
    
    await AuditLog.log({
        action: 'STUDENT_UPDATE',
        category: 'STUDENT',
        user: req.user,
        resource: {
            type: 'Student',
            id: student._id,
            identifier: student.studentNumber
        },
        changes: {
            before,
            after: {
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                faculty: student.faculty,
                department: student.department,
                grade: student.grade,
                status: student.status
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
        message: 'Öğrenci başarıyla güncellendi',
        data: student
    });
});

const deleteStudent = asyncHandler(async (req, res, next) => {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    await student.softDelete(req.user._id);
    
    await AuditLog.log({
        action: 'STUDENT_DELETE',
        category: 'STUDENT',
        user: req.user,
        resource: {
            type: 'Student',
            id: student._id,
            identifier: student.studentNumber
        },
        details: { studentNumber: student.studentNumber },
        request: req,
        client: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        },
        result: { success: true, statusCode: 200 },
        severity: 'HIGH'
    });
    
    logger.info(`Öğrenci silindi: ${student.studentNumber} by ${req.user.email}`);
    
    res.status(200).json({
        success: true,
        message: 'Öğrenci başarıyla silindi'
    });
});

const restoreStudent = asyncHandler(async (req, res, next) => {
    const student = await Student.findOne({ _id: req.params.id, includeDeleted: true });
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    if (!student.isDeleted) {
        return next(new AppError('Bu öğrenci zaten aktif', 400));
    }
    
    await student.restore();
    
    await AuditLog.log({
        action: 'STUDENT_RESTORE',
        category: 'STUDENT',
        user: req.user,
        resource: {
            type: 'Student',
            id: student._id,
            identifier: student.studentNumber
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
        message: 'Öğrenci başarıyla geri getirildi',
        data: student
    });
});

const getStudentDisciplinaryRecords = asyncHandler(async (req, res, next) => {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
        return next(new AppError('Öğrenci bulunamadı', 404));
    }
    
    const records = await DisciplinaryRecord.find({ student: req.params.id })
        .sort('-createdAt')
        .populate('createdBy', 'firstName lastName email');
    
    res.status(200).json({
        success: true,
        data: {
            student: {
                id: student._id,
                studentNumber: student.studentNumber,
                fullName: student.fullName,
                disciplinaryStats: student.disciplinaryStats
            },
            records
        }
    });
});

const getFaculties = asyncHandler(async (req, res, next) => {
    const faculties = await Student.distinct('faculty');
    
    res.status(200).json({
        success: true,
        data: faculties
    });
});

const getDepartments = asyncHandler(async (req, res, next) => {
    const filter = req.query.faculty ? { faculty: req.query.faculty } : {};
    const departments = await Student.distinct('department', filter);
    
    res.status(200).json({
        success: true,
        data: departments
    });
});

module.exports = {
    getStudents,
    getStudent,
    getStudentByNumber,
    createStudent,
    updateStudent,
    deleteStudent,
    restoreStudent,
    getStudentDisciplinaryRecords,
    getFaculties,
    getDepartments
};
