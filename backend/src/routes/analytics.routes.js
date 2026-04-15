const router = require('express').Router();
const { riskTrend, mortalityTrend, diseaseFrequency, summary } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/risk-trend', riskTrend);
router.get('/mortality-trend', mortalityTrend);
router.get('/disease-frequency', diseaseFrequency);
router.get('/summary', summary);

module.exports = router;
