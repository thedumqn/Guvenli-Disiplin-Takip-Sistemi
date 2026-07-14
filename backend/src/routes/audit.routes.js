const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { protect, authorize, hasPermission } = require('../middlewares/auth');
const { mongoIdValidator, paginationValidator } = require('../middlewares/validator');

router.use(protect);

router.use((req, res, next) => {
    if (req.user.role === 'admin' || req.user.permissions?.includes('view_audit_logs')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Bu işlem için yetkiniz yok'
    });
});

router.get('/', paginationValidator, auditController.getAuditLogs);
router.get('/actions', auditController.getActionTypes);
router.get('/stats', auditController.getAuditStats);
router.get('/security', auditController.getSecurityEvents);
router.get('/failed-logins', auditController.getFailedLogins);
router.get('/user/:userId', auditController.getUserActivity);
router.get('/resource/:type/:id', auditController.getResourceLogs);
router.get('/:id', mongoIdValidator, auditController.getAuditLog);

module.exports = router;
