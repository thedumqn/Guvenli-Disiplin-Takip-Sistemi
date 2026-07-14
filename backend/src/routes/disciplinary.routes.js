const express = require('express');
const router = express.Router();
const disciplinaryController = require('../controllers/disciplinary.controller');
const { protect, authorize, hasPermission } = require('../middlewares/auth');
const { 
    createDisciplinaryRecordValidator, 
    updateDisciplinaryRecordValidator, 
    mongoIdValidator, 
    paginationValidator 
} = require('../middlewares/validator');

router.use(protect);

router.get('/penalty-types', disciplinaryController.getPenaltyTypes);
router.get('/stats', disciplinaryController.getStats);

router.route('/')
    .get(paginationValidator, disciplinaryController.getRecords)
    .post(
        hasPermission('create_record'),
        createDisciplinaryRecordValidator, 
        disciplinaryController.createRecord
    );

router.route('/:id')
    .get(mongoIdValidator, disciplinaryController.getRecord)
    .put(
        hasPermission('update_record'),
        updateDisciplinaryRecordValidator, 
        disciplinaryController.updateRecord
    )
    .delete(
        authorize('admin', 'kurul_uyesi'),
        mongoIdValidator, 
        disciplinaryController.deleteRecord
    );

router.patch(
    '/:id/status',
    hasPermission('update_record'),
    mongoIdValidator,
    disciplinaryController.updateRecordStatus
);

router.post(
    '/:id/appeal',
    mongoIdValidator,
    disciplinaryController.submitAppeal
);

router.patch(
    '/:id/appeal-decision',
    authorize('admin', 'kurul_uyesi'),
    mongoIdValidator,
    disciplinaryController.decideAppeal
);

module.exports = router;
