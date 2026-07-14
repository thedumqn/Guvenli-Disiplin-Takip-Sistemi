const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth');
const { registerValidator, mongoIdValidator, paginationValidator } = require('../middlewares/validator');

router.post('/register', registerValidator, userController.register);

router.use(protect);
router.use(authorize('admin'));

router.route('/')
    .get(paginationValidator, userController.getUsers)
    .post(registerValidator, userController.createUser);

router.route('/:id')
    .get(mongoIdValidator, userController.getUser)
    .put(mongoIdValidator, userController.updateUser)
    .delete(mongoIdValidator, userController.deleteUser);

router.post('/:id/reset-password', mongoIdValidator, userController.resetUserPassword);
router.post('/:id/lock', mongoIdValidator, userController.toggleUserLock);

module.exports = router;