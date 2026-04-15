const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { chat, narrative, encyclopedia, clearChatSession } = require('../controllers/ai.controller');

router.use(authenticate);

router.post('/chat', chat);
router.post('/narrative', narrative);
router.post('/encyclopedia', encyclopedia);
router.post('/chat/clear', clearChatSession);

module.exports = router;
