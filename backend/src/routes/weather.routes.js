const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getWeather } = require('../services/weatherService');

router.get('/', authenticate, async (req, res) => {
  const { lat, lon, state } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  const weather = await getWeather(parseFloat(lat), parseFloat(lon), state);
  res.json({ weather });
});

module.exports = router;
