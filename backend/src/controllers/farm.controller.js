const pool = require('../db/db');

async function getFarms(req, res) {
  const { rows } = await pool.query(
    `SELECT f.*,
       (SELECT COUNT(*) FROM flocks fl WHERE fl.farm_id = f.id AND fl.is_active = true) AS flock_count,
       (SELECT COALESCE(SUM(fl.flock_size), 0) FROM flocks fl WHERE fl.farm_id = f.id AND fl.is_active = true) AS total_birds,
       (SELECT assessed_at FROM risk_assessments ra WHERE ra.farm_id = f.id ORDER BY assessed_at DESC LIMIT 1) AS last_assessed_at
     FROM farms f
     WHERE f.user_id = $1 AND f.is_active = true
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json({ farms: rows });
}

async function createFarm(req, res) {
  const { name, state, lga, address, latitude, longitude, housing_type } = req.body;
  if (!name || !state || !lga) {
    return res.status(400).json({ error: 'Name, state and LGA are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO farms (user_id, name, state, lga, address, latitude, longitude, housing_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [req.user.id, name, state, lga, address, latitude, longitude, housing_type]
  );
  res.status(201).json({ farm: rows[0] });
}

async function getFarm(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM farms WHERE id = $1 AND user_id = $2 AND is_active = true',
    [id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Farm not found' });

  const { rows: flocks } = await pool.query(
    'SELECT * FROM flocks WHERE farm_id = $1 AND is_active = true ORDER BY created_at DESC',
    [id]
  );
  res.json({ farm: rows[0], flocks });
}

async function updateFarm(req, res) {
  const { id } = req.params;
  const { name, state, lga, address, latitude, longitude, housing_type } = req.body;

  const { rows } = await pool.query(
    `UPDATE farms SET name=$1, state=$2, lga=$3, address=$4, latitude=$5, longitude=$6,
     housing_type=$7, updated_at=NOW()
     WHERE id=$8 AND user_id=$9 AND is_active=true RETURNING *`,
    [name, state, lga, address, latitude, longitude, housing_type, id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Farm not found' });
  res.json({ farm: rows[0] });
}

async function deleteFarm(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    'UPDATE farms SET is_active=false, updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Farm not found' });
  res.json({ message: 'Farm deleted' });
}

module.exports = { getFarms, createFarm, getFarm, updateFarm, deleteFarm };
