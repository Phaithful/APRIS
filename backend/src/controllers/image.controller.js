const path = require('path');
const pool = require('../db/db');
const { callImagePredict } = require('../services/mlService');
const { generateImageAlert } = require('../services/alertService');

async function analyseImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Image file is required' });

  const { farm_id, flock_id, assessment_id } = req.body;

  // Verify farm ownership
  if (farm_id) {
    const { rows } = await pool.query(
      'SELECT id, name FROM farms WHERE id=$1 AND user_id=$2 AND is_active=true',
      [farm_id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Farm not found' });
  }

  // Call ML service
  let mlResult;
  try {
    mlResult = await callImagePredict(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    return res.status(503).json({ error: 'ML service unavailable: ' + err.message });
  }

  // Save to DB
  const { rows } = await pool.query(
    `INSERT INTO image_analyses
       (farm_id, flock_id, assessment_id, image_filename, predicted_class,
        severity, severity_level, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      farm_id || null, flock_id || null, assessment_id || null,
      req.file.originalname,
      mlResult.predicted_disease,
      mlResult.severity,
      mlResult.severity_level,
      mlResult.confidence,
    ]
  );
  const imageAnalysis = rows[0];

  // Fire alert without blocking the response
  if (farm_id && mlResult.predicted_disease !== 'healthy') {
    pool.query('SELECT name FROM farms WHERE id=$1', [farm_id]).then(({ rows }) => {
      generateImageAlert({
        userId: req.user.id,
        farmId: farm_id,
        flockId: flock_id || null,
        imageId: imageAnalysis.id,
        predictedDisease: mlResult.predicted_disease,
        farmName: rows[0]?.name || 'Unknown Farm',
      }).catch(console.error);
    }).catch(console.error);
  }

  res.status(201).json({ analysis: { ...imageAnalysis, ...mlResult } });
}

async function getImageHistory(req, res) {
  const { farmId, farm_id, flockId, flock_id, limit = 20, offset = 0 } = req.query;
  const resolvedFarmId = farmId || farm_id;
  const resolvedFlockId = flockId || flock_id;
  let query = `
    SELECT ia.*, f.name as farm_name, fl.name as flock_name
    FROM image_analyses ia
    LEFT JOIN farms f ON f.id = ia.farm_id
    LEFT JOIN flocks fl ON fl.id = ia.flock_id
    WHERE f.user_id = $1
  `;
  const params = [req.user.id];

  if (resolvedFarmId) { params.push(resolvedFarmId); query += ` AND ia.farm_id = $${params.length}`; }
  if (resolvedFlockId) { params.push(resolvedFlockId); query += ` AND ia.flock_id = $${params.length}`; }

  query += ` ORDER BY ia.analysed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await pool.query(query, params);
  res.json({ analyses: rows });
}

module.exports = { analyseImage, getImageHistory };
