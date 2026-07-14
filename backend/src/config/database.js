const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            minPoolSize: 2,
            
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            
            retryWrites: true,
            retryReads: true,
            
            autoIndex: process.env.NODE_ENV !== 'production', // Production'da manuel index
            family: 4 // IPv4 kullan
        };

        if (process.env.NODE_ENV === 'production') {
            options.ssl = true;
            options.sslValidate = true;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, options);

        logger.info(`MongoDB bağlantısı başarılı: ${conn.connection.host}`);

        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB bağlantı hatası:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB bağlantısı kesildi');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB yeniden bağlandı');
        });

        return conn;
    } catch (error) {
        logger.error('MongoDB bağlantı hatası:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
