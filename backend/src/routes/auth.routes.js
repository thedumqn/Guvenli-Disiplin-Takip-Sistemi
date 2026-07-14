const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');
const { loginValidator, changePasswordValidator } = require('../middlewares/validator');
const { setCSRFToken, getCSRFToken } = require('../middlewares/csrf');

router.post('/login', authController.loginLimiter, loginValidator, authController.login);
router.post('/refresh', authController.refreshToken);
router.get('/csrf-token', setCSRFToken, getCSRFToken);

router.use(protect); // Bu noktadan sonra tüm route'lar korumalı

router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);
router.post('/change-password', changePasswordValidator, authController.changePassword);
router.get('/me', authController.getMe);
router.get('/sessions', authController.getSessions);
router.delete('/sessions/:sessionId', authController.revokeSession);

module.exports = router;
