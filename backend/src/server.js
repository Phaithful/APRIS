require('dotenv').config();
const app = require('./app');
const pool = require('./db/db');
const { checkMLService } = require('./services/mlService');

const PORT = process.env.PORT || 3001;

async function start() {
  // Test DB connection
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected.');
  } catch (err) {
    if (!process.env.DB_URL) {
      console.error('Database connection failed: DB_URL is not set. Did you create backend/.env?');
    } else {
      console.error('Database connection failed:', err.message);
      console.error('DB_URL:', process.env.DB_URL);
    }
    process.exit(1);
  }

  // Ping ML service (non-blocking)
  checkMLService().then((ok) => {
    if (ok) console.log('ML service reachable at', process.env.ML_SERVICE_URL);
    else console.warn('ML service not reachable — predictions will fail until it starts.');
  });

  app.listen(PORT, () => {
    console.log(`APRIS backend running on http://localhost:${PORT}`);
  });
}

start();
