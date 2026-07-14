const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            log += ` | ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        )
    })
];

if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/app.log'),
            format: jsonFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    );
    
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            format: jsonFormat,
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true
        })
    );
    
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/security.log'),
            level: 'warn',
            format: jsonFormat,
            maxsize: 5242880,
            maxFiles: 10,
            tailable: true
        })
    );
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    exceptionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' 
            ? [new winston.transports.File({ filename: path.join(__dirname, '../../logs/exceptions.log') })]
            : []
        )
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production'
            ? [new winston.transports.File({ filename: path.join(__dirname, '../../logs/rejections.log') })]
            : []
        )
    ]
});

logger.http = (meta) => {
    logger.log('http', 'HTTP Request', meta);
};

logger.securityEvent = (event, details) => {
    logger.warn(`[SECURITY] ${event}`, details);
};

logger.authFailure = (details) => {
    logger.warn('[AUTH_FAILURE]', details);
};

logger.accessDenied = (details) => {
    logger.warn('[ACCESS_DENIED]', details);
};

logger.suspiciousActivity = (details) => {
    logger.warn('[SUSPICIOUS]', details);
};

module.exports = logger;
