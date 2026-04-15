const router = require('express').Router();
const { getFarms, createFarm, getFarm, updateFarm, deleteFarm } = require('../controllers/farm.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', getFarms);
router.post('/', createFarm);
router.get('/:id', getFarm);
router.put('/:id', updateFarm);
router.delete('/:id', deleteFarm);

module.exports = router;
