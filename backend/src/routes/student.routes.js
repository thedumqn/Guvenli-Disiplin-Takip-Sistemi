const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { protect, authorize, hasPermission } = require('../middlewares/auth');
const { 
    createStudentValidator, 
    updateStudentValidator, 
    mongoIdValidator, 
    paginationValidator 
} = require('../middlewares/validator');

router.use(protect);

router.get('/faculties', studentController.getFaculties);
router.get('/departments', studentController.getDepartments);
router.get('/number/:studentNumber', studentController.getStudentByNumber);

router.route('/')
    .get(paginationValidator, studentController.getStudents)
    .post(
        hasPermission('manage_students'),
        createStudentValidator, 
        studentController.createStudent
    );

router.route('/:id')
    .get(mongoIdValidator, studentController.getStudent)
    .put(
        hasPermission('manage_students'),
        updateStudentValidator, 
        studentController.updateStudent
    )
    .delete(
        authorize('admin'),
        mongoIdValidator, 
        studentController.deleteStudent
    );

router.post(
    '/:id/restore', 
    authorize('admin'),
    mongoIdValidator, 
    studentController.restoreStudent
);

router.get(
    '/:id/disciplinary-records', 
    mongoIdValidator, 
    studentController.getStudentDisciplinaryRecords
);

module.exports = router;
