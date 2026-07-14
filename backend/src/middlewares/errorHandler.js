const logger = require('../utils/logger');

class AppError extends Error {
    constructor(message, statusCode, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
    }));
    
    return new AppError('Geçersiz veri girişi', 400, 'VALIDATION_ERROR');
};

const handleCastError = (err) => {
    return new AppError(`Geçersiz ${err.path}: ${err.value}`, 400, 'CAST_ERROR');
};

const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    let message = `Bu ${field} zaten kayıtlı`;
    if (field === 'email') {
        message = 'Bu email adresi zaten kayıtlı';
    } else if (field === 'tcKimlik') {
        message = 'Bu TC Kimlik numarası zaten kayıtlı';
    } else if (field === 'studentNumber') {
        message = 'Bu öğrenci numarası zaten kayıtlı';
    }
    
    return new AppError(message, 409, 'DUPLICATE_KEY');
};

const handleJWTError = () => {
    return new AppError('Geçersiz token. Lütfen tekrar giriş yapın.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
    return new AppError('Token süresi dolmuş. Lütfen tekrar giriş yapın.', 401, 'TOKEN_EXPIRED');
};

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    if (err.statusCode >= 500) {
        logger.error('Server Error:', {
            requestId: req.requestId,
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    } else if (err.statusCode >= 400) {
        logger.warn('Client Error:', {
            requestId: req.requestId,
            error: err.message,
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    }
    
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else {
        let error = { ...err };
        error.message = err.message;
        error.name = err.name;
        
        if (err.name === 'ValidationError') error = handleValidationError(err);
        if (err.name === 'CastError') error = handleCastError(err);
        if (err.code === 11000) error = handleDuplicateKeyError(err);
        
        if (err.name === 'JsonWebTokenError') error = handleJWTError();
        if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, req, res);
    }
};

const sendErrorDev = (err, req, res) => {
    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
        code: err.code,
        error: err,
        stack: err.stack,
        requestId: req.requestId
    });
};

const sendErrorProd = (err, req, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message,
            code: err.code,
            requestId: req.requestId
        });
    } 
    else {
        logger.error('CRITICAL ERROR:', {
            requestId: req.requestId,
            error: err,
            stack: err.stack
        });
        
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Bir şeyler ters gitti. Lütfen daha sonra tekrar deneyiniz.',
            requestId: req.requestId
        });
    }
};

const notFound = (req, res, next) => {
    const error = new AppError(`${req.originalUrl} bulunamadı`, 404, 'NOT_FOUND');
    next(error);
};

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.notFound = notFound;
module.exports.asyncHandler = asyncHandler;
