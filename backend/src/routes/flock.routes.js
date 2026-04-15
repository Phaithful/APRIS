const router = require('express').Router();
const { getFlocks, createFlock, updateFlock, deleteFlock } = require('../controllers/flock.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/farms/:farmId/flocks', getFlocks);
router.post('/farms/:farmId/flocks', createFlock);
router.put('/flocks/:id', updateFlock);
router.delete('/flocks/:id', deleteFlock);

module.exports = router;
