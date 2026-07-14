require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const studentRoutes = require('./routes/student.routes');
const disciplinaryRoutes = require('./routes/disciplinary.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
}));

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS ihlali: ${origin}`);
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 600 // Preflight cache 10 dakika
};
app.use(cors(corsOptions));

const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 dakika
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: 'Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.',
        retryAfter: '15 dakika'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit aşıldı: IP=${req.ip}, Path=${req.path}`);
        res.status(429).json(options.message);
    }
});
app.use(generalLimiter);

app.use(express.json({ 
    limit: '10kb', // JSON payload max 10KB
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(hpp({
    whitelist: ['sort', 'page', 'limit'] // İzin verilen duplicate parametreler
}));

app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        logger.warn(`NoSQL Injection denemesi engellendi: IP=${req.ip}, Key=${key}`);
    }
}));

const { v4: uuidv4 } = require('uuid');
app.use((req, res, next) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http({
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Server çalışıyor',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/disciplinary', disciplinaryRoutes);
app.use('/api/v1/audit', auditRoutes);

app.use('*', (req, res) => {
    logger.warn(`404 - Bulunamadı: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: 'İstenen kaynak bulunamadı'
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET', 'DB_ENCRYPTION_KEY'];

const validateEnv = () => {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        logger.error(`Eksik ortam degiskenleri: ${missing.join(', ')}. .env.example dosyasindaki komutlarla uretip doldurun.`);
        process.exit(1);
    }
    if (Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex').length !== 32) {
        logger.error('DB_ENCRYPTION_KEY 64 karakterlik hex bir deger olmalidir (openssl rand -hex 32)');
        process.exit(1);
    }
};

const startServer = async () => {
    try {
        validateEnv();

        await connectDB();
        
        app.listen(PORT, () => {
            logger.info(`
╔══════════════════════════════════════════════════════════╗
║     GÜVENLİ DİSİPLİN İŞLERİ TAKİP SİSTEMİ               ║
║     Server Port: ${PORT}                                    ║
║     Environment: ${process.env.NODE_ENV || 'development'}                        ║
║     Güvenlik Modülleri: AKTİF                            ║
╚══════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        logger.error('Server başlatılamadı:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => {
    logger.info('SIGTERM sinyali alındı. Server kapatılıyor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT sinyali alındı. Server kapatılıyor...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { reason, promise });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

startServer();
