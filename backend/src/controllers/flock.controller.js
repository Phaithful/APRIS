const pool = require('../db/db');
const { generateMortalityAlert } = require('../services/alertService');

async function getFlocks(req, res) {
  const { farmId } = req.params;
  const { rows } = await pool.query(
    `SELECT fl.id, fl.farm_id, fl.name, fl.species, fl.flock_size,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - fl.hatch_date)) / 604800))::int AS age_weeks,
            fl.hatch_date, fl.vaccinated, fl.vaccination_notes,
            fl.current_mortality_rate, fl.feed_intake_pct,
            fl.is_active, fl.created_at, fl.updated_at
     FROM flocks fl
     JOIN farms f ON f.id = fl.farm_id
     WHERE fl.farm_id = $1 AND f.user_id = $2 AND fl.is_active = true
     ORDER BY fl.created_at DESC`,
    [farmId, req.user.id]
  );
  res.json({ flocks: rows });
}

async function createFlock(req, res) {
  const { farmId } = req.params;
  const { name, species, flock_size, age_weeks, vaccinated, vaccination_notes, feed_intake_pct } = req.body;

  if (flock_size == null || age_weeks == null || flock_size === '' || age_weeks === '') {
    return res.status(400).json({ error: 'Flock size and age are required' });
  }

  // Verify farm ownership
  const { rows: farmRows } = await pool.query(
    'SELECT id FROM farms WHERE id=$1 AND user_id=$2 AND is_active=true',
    [farmId, req.user.id]
  );
  if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });

  const { rows } = await pool.query(
    `INSERT INTO flocks (farm_id, name, species, flock_size, age_weeks, hatch_date, vaccinated, vaccination_notes, feed_intake_pct)
     VALUES ($1,$2,$3,$4,$5, (CURRENT_DATE - (($5::int * 7)::text || ' days')::interval)::date, $6,$7,$8) RETURNING *`,
    [farmId, name, species, flock_size, age_weeks, vaccinated || false, vaccination_notes, feed_intake_pct || 100]
  );
  res.status(201).json({ flock: rows[0] });
}

async function updateFlock(req, res) {
  const { id } = req.params;
  const { name, species, flock_size, age_weeks, vaccinated, vaccination_notes,
          current_mortality_rate, feed_intake_pct } = req.body;

  // Fetch previous mortality for alert check
  const { rows: prev } = await pool.query(
    'SELECT current_mortality_rate, farm_id, name FROM flocks WHERE id=$1 AND is_active=true',
    [id]
  );
  if (!prev.length) return res.status(404).json({ error: 'Flock not found' });

  const { rows } = await pool.query(
    `UPDATE flocks SET name=COALESCE($1,name), species=COALESCE($2,species),
     flock_size=COALESCE($3,flock_size),
     age_weeks=COALESCE($4,age_weeks),
     hatch_date=CASE WHEN $4 IS NOT NULL THEN (CURRENT_DATE - (($4::int * 7)::text || ' days')::interval)::date ELSE hatch_date END,
     vaccinated=COALESCE($5,vaccinated), vaccination_notes=COALESCE($6,vaccination_notes),
     current_mortality_rate=COALESCE($7,current_mortality_rate),
     feed_intake_pct=COALESCE($8,feed_intake_pct), updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [name, species, flock_size, age_weeks ?? null, vaccinated, vaccination_notes,
     current_mortality_rate, feed_intake_pct, id]
  );

  // Check mortality threshold
  const newRate = parseFloat(current_mortality_rate);
  const oldRate = parseFloat(prev[0].current_mortality_rate);
  if (!isNaN(newRate) && !isNaN(oldRate) && newRate - oldRate > 2) {
    const { rows: farmRow } = await pool.query(
      'SELECT f.name, f.user_id FROM farms f JOIN flocks fl ON fl.farm_id=f.id WHERE fl.id=$1',
      [id]
    );
    if (farmRow.length) {
      await generateMortalityAlert({
        userId: farmRow[0].user_id,
        farmId: prev[0].farm_id,
        flockId: id,
        farmName: farmRow[0].name,
        flockName: rows[0].name,
        rate: newRate,
      }).catch(console.error);
    }
  }

  res.json({ flock: rows[0] });
}

async function deleteFlock(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    'UPDATE flocks SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id',
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Flock not found' });
  res.json({ message: 'Flock deleted' });
}

module.exports = { getFlocks, createFlock, updateFlock, deleteFlock };
