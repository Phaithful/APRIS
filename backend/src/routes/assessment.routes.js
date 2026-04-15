const router = require('express').Router();
const { createAssessment, getAssessments, getAssessment, completeMitigation } = require('../controllers/assessment.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/', createAssessment);
router.get('/', getAssessments);
router.get('/:id', getAssessment);
router.patch('/mitigations/:id/complete', completeMitigation);

module.exports = router;
