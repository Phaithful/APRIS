require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const farmRoutes = require('./routes/farm.routes');
const flockRoutes = require('./routes/flock.routes');
const assessmentRoutes = require('./routes/assessment.routes');
const imageRoutes = require('./routes/image.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const weatherRoutes = require('./routes/weather.routes');
const adminRoutes = require('./routes/admin.routes');
const alertRoutes = require('./routes/alert.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();

// Security headers
app.use(helmet());

// CORS — allow frontend only
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting — strict on auth endpoints, generous on data endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
// AI endpoints get a tighter per-user cap to control Anthropic API costs
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1-hour window
  max: 40,                   // 40 AI calls per user per hour
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Please try again in an hour.' },
});

app.use(express.json());
app.use(cookieParser());

// Static uploads (for served images)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/farms', apiLimiter, farmRoutes);
app.use('/api', apiLimiter, flockRoutes);
app.use('/api/assessments', apiLimiter, assessmentRoutes);
app.use('/api', apiLimiter, imageRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/weather', apiLimiter, weatherRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/alerts', apiLimiter, alertRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'apris-backend' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
