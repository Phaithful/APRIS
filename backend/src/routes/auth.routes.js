const router = require('express').Router();
const { register, login, logout, me, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);

module.exports = router;
