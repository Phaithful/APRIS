const router = require('express').Router();
const { getUsers, updateUser, getStats } = require('../controllers/admin.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

router.use(authenticate, requireRole('admin'));
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.get('/stats', getStats);

module.exports = router;
