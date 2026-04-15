const router = require('express').Router();
const { getAlerts, dismissAlert, markAllRead } = require('../controllers/alert.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', getAlerts);
router.patch('/:id/dismiss', dismissAlert);
router.post('/mark-all-read', markAllRead);

module.exports = router;
