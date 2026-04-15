const pool = require('../db/db');

async function riskTrend(req, res) {
  const { farmId, days = 30 } = req.query;
  if (!farmId) return res.status(400).json({ error: 'farmId is required' });

  const { rows } = await pool.query(
    `SELECT DATE(ra.assessed_at) as date,
            AVG(ra.risk_score)::int as risk_score,
            ra.risk_level,
            AVG(ra.temperature)::numeric(4,1) as temperature,
            AVG(ra.humidity)::numeric(4,1) as humidity
     FROM risk_assessments ra
     JOIN farms f ON f.id = ra.farm_id
     WHERE ra.farm_id = $1 AND f.user_id = $2
       AND ra.assessed_at >= NOW() - ($3 || ' days')::interval
     GROUP BY DATE(ra.assessed_at), ra.risk_level
     ORDER BY date ASC`,
    [farmId, req.user.id, parseInt(days)]
  );
  res.json({ data: rows });
}

async function mortalityTrend(req, res) {
  const { flockId, farmId, days = 30 } = req.query;
  let query, params;

  if (flockId) {
    query = `
      SELECT DATE(ra.assessed_at) as date,
             AVG(ra.mortality_rate_pct) as mortality_rate
      FROM risk_assessments ra
      WHERE ra.flock_id = $1
        AND ra.assessed_at >= NOW() - ($2 || ' days')::interval
      GROUP BY DATE(ra.assessed_at)
      ORDER BY date ASC`;
    params = [flockId, parseInt(days)];
  } else if (farmId) {
    query = `
      SELECT DATE(ra.assessed_at) as date,
             AVG(ra.mortality_rate_pct) as mortality_rate
      FROM risk_assessments ra
      JOIN farms f ON f.id = ra.farm_id
      WHERE ra.farm_id = $1 AND f.user_id = $2
        AND ra.assessed_at >= NOW() - ($3 || ' days')::interval
      GROUP BY DATE(ra.assessed_at)
      ORDER BY date ASC`;
    params = [farmId, req.user.id, parseInt(days)];
  } else {
    return res.status(400).json({ error: 'farmId or flockId required' });
  }

  const { rows } = await pool.query(query, params);
  res.json({ data: rows });
}

async function diseaseFrequency(req, res) {
  const { farmId, days = 90 } = req.query;
  if (!farmId) return res.status(400).json({ error: 'farmId is required' });

  const { rows } = await pool.query(
    `SELECT dp.disease_name, COUNT(*) as count
     FROM disease_predictions dp
     JOIN risk_assessments ra ON ra.id = dp.assessment_id
     JOIN farms f ON f.id = ra.farm_id
     WHERE ra.farm_id = $1 AND f.user_id = $2
       AND dp.rank = 1
       AND ra.assessed_at >= NOW() - ($3 || ' days')::interval
     GROUP BY dp.disease_name
     ORDER BY count DESC`,
    [farmId, req.user.id, parseInt(days)]
  );
  res.json({ data: rows });
}

async function summary(req, res) {
  const { farmId } = req.query;
  if (!farmId) return res.status(400).json({ error: 'farmId is required' });

  const [assessCount, flockCount, lastAssess, avgRisk] = await Promise.all([
    pool.query(
      'SELECT COUNT(*) FROM risk_assessments ra JOIN farms f ON f.id=ra.farm_id WHERE ra.farm_id=$1 AND f.user_id=$2',
      [farmId, req.user.id]
    ),
    pool.query(
      'SELECT COUNT(*) FROM flocks fl JOIN farms f ON f.id=fl.farm_id WHERE fl.farm_id=$1 AND f.user_id=$2 AND fl.is_active=true',
      [farmId, req.user.id]
    ),
    pool.query(
      'SELECT risk_level, risk_score, assessed_at FROM risk_assessments WHERE farm_id=$1 ORDER BY assessed_at DESC LIMIT 1',
      [farmId]
    ),
    pool.query(
      'SELECT AVG(risk_score)::int as avg_score FROM risk_assessments WHERE farm_id=$1',
      [farmId]
    ),
  ]);

  res.json({
    total_assessments: parseInt(assessCount.rows[0].count),
    active_flocks: parseInt(flockCount.rows[0].count),
    last_assessment: lastAssess.rows[0] || null,
    average_risk_score: avgRisk.rows[0].avg_score || 0,
  });
}

module.exports = { riskTrend, mortalityTrend, diseaseFrequency, summary };
