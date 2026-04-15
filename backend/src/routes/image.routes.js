const router = require('express').Router();
const { analyseImage, getImageHistory } = require('../controllers/image.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authenticate);
router.post('/images/analyse', upload.single('image'), analyseImage);
router.get('/images/history', getImageHistory);
router.get('/images', getImageHistory);

module.exports = router;
