const pool = require('../db/db');
const { getWeather } = require('../services/weatherService');
const { callRiskPredict } = require('../services/mlService');
const { generateAssessmentAlert } = require('../services/alertService');

async function createAssessment(req, res) {
  const { farm_id, flock_id } = req.body;
  if (!farm_id) return res.status(400).json({ error: 'farm_id is required' });

  // Verify ownership
  const { rows: farmRows } = await pool.query(
    'SELECT * FROM farms WHERE id=$1 AND user_id=$2 AND is_active=true',
    [farm_id, req.user.id]
  );
  if (!farmRows.length) return res.status(404).json({ error: 'Farm not found' });
  const farm = farmRows[0];

  // Get flock data
  let flock = null;
  if (flock_id) {
    const { rows: flockRows } = await pool.query(
      `SELECT *, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - hatch_date)) / 604800))::int AS age_weeks
       FROM flocks WHERE id=$1 AND farm_id=$2 AND is_active=true`,
      [flock_id, farm_id]
    );
    if (flockRows.length) flock = flockRows[0];
  }
  if (!flock) {
    const { rows: flockRows } = await pool.query(
      `SELECT *, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - hatch_date)) / 604800))::int AS age_weeks
       FROM flocks WHERE farm_id=$1 AND is_active=true ORDER BY updated_at DESC LIMIT 1`,
      [farm_id]
    );
    if (flockRows.length) flock = flockRows[0];
  }
  if (!flock) return res.status(400).json({ error: 'No active flock found for this farm' });

  // Fetch weather
  const weather = await getWeather(farm.latitude, farm.longitude, farm.state);

  // Build feature vector — clamp all values to the ML schema's accepted ranges.
  // Live signals (mortality, feed intake, outbreak, wild birds) come from the
  // request body when the user fills in the pre-assessment quick check. Fall
  // back to the stored flock values only if not provided.
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const liveMortality  = req.body.mortality_rate_pct  != null ? parseFloat(req.body.mortality_rate_pct)  : null;
  const liveFeedIntake = req.body.feed_intake_pct     != null ? parseFloat(req.body.feed_intake_pct)     : null;

  const featureVector = {
    temperature_c:       clamp(parseFloat(weather.temperature) || 28,  18,  42),
    humidity_pct:        clamp(parseFloat(weather.humidity)    || 65,  30,  95),
    rainfall_mm:         clamp(parseFloat(weather.rainfall)    ||  0,   0, 200),
    season:              weather.season  || 'dry',
    region:              weather.region  || 'south_west',
    flock_age_weeks:     clamp(parseInt(flock.age_weeks)  ||  1,   1,  72),
    flock_size:          clamp(parseInt(flock.flock_size) ||  1,   1, 1_000_000),
    // ML model only knows open_sided/closed/battery_cage — map 'mixed' to open_sided
    housing_type:        (['open_sided','closed','battery_cage'].includes(farm.housing_type)
                           ? farm.housing_type : 'open_sided'),
    vaccinated:          flock.vaccinated ? 1 : 0,
    nearby_outbreak:     req.body.nearby_outbreak     ?? 0,
    wild_bird_proximity: req.body.wild_bird_proximity ?? 0,
    // Prefer live values from the quick-check modal; fall back to DB record
    mortality_rate_pct:  clamp(liveMortality  ?? parseFloat(flock.current_mortality_rate) ?? 0,   0, 100),
    feed_intake_pct:     clamp(liveFeedIntake ?? parseFloat(flock.feed_intake_pct)        ?? 100, 0, 100),
  };

  // Persist the live values back to the flock so the record stays current
  const deathCount = parseInt(req.body.death_count) || 0;
  if (liveMortality != null || liveFeedIntake != null || deathCount > 0) {
    await pool.query(
      `UPDATE flocks SET
         current_mortality_rate = COALESCE($1, current_mortality_rate),
         feed_intake_pct        = COALESCE($2, feed_intake_pct),
         flock_size             = GREATEST(1, flock_size - $3),
         updated_at             = NOW()
       WHERE id = $4`,
      [
        liveMortality  != null ? liveMortality  : null,
        liveFeedIntake != null ? liveFeedIntake : null,
        deathCount,
        flock.id,
      ]
    );
  }

  // Call ML service
  let mlResult;
  try {
    mlResult = await callRiskPredict(featureVector);
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    console.error('ML service error:', JSON.stringify({ featureVector, detail }, null, 2));
    return res.status(503).json({ error: 'ML service unavailable: ' + detail });
  }

  // ── Mitigation adherence adjustment ──────────────────────────────────────────
  // Query distinct mitigation categories the farmer completed in the last 7 days
  // on this farm. Each completed category reduces the ML's raw risk score, giving
  // the system "memory" of actions already taken.
  const { rows: completedCats } = await pool.query(
    `SELECT DISTINCT m.category
     FROM mitigations m
     JOIN risk_assessments ra ON ra.id = m.assessment_id
     WHERE ra.farm_id = $1
       AND m.is_completed = true
       AND m.completed_at > NOW() - INTERVAL '7 days'`,
    [farm_id]
  );

  // Points off per category (higher impact actions earn more reduction)
  const CATEGORY_REDUCTION = {
    vet_alert:   8,   // calling a vet is the highest-impact action
    biosecurity: 6,
    treatment:   5,
    environment: 4,
    nutrition:   3,
  };

  const completedCatSet = new Set(completedCats.map((r) => r.category));
  let scoreReduction = 0;
  for (const cat of completedCatSet) {
    scoreReduction += CATEGORY_REDUCTION[cat] || 3;
  }
  // Cap total reduction at 20 points — we don't want actions to mask a genuinely
  // dangerous environment (e.g. nearby outbreak + bad weather still = risk)
  scoreReduction = Math.min(scoreReduction, 20);

  const adjustedScore = Math.max(5, mlResult.risk_score - scoreReduction);

  // Re-derive risk level from adjusted score (mirrors ML thresholds)
  function scoreToLevel(s) {
    if (s <= 35) return 'low';
    if (s <= 60) return 'medium';
    if (s <= 80) return 'high';
    return 'critical';
  }
  const adjustedLevel = scoreReduction > 0 ? scoreToLevel(adjustedScore) : mlResult.risk_level;
  const finalScore = adjustedScore;
  const finalLevel = adjustedLevel;

  // Save assessment
  const { rows: assessRows } = await pool.query(
    `INSERT INTO risk_assessments
       (farm_id, flock_id, risk_level, risk_score, temperature, humidity, rainfall,
        season, region, nearby_outbreak, wild_bird_proximity, weather_snapshot, mortality_rate_pct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      farm_id, flock.id, finalLevel, finalScore,
      weather.temperature, weather.humidity, weather.rainfall,
      weather.season, weather.region,
      featureVector.nearby_outbreak, featureVector.wild_bird_proximity,
      JSON.stringify(weather.raw || weather),
      featureVector.mortality_rate_pct,
    ]
  );
  const assessment = assessRows[0];

  // Save disease predictions
  for (const dis of mlResult.diseases) {
    await pool.query(
      `INSERT INTO disease_predictions (assessment_id, disease_name, probability, severity, rank)
       VALUES ($1,$2,$3,$4,$5)`,
      [assessment.id, dis.disease_name, dis.probability, dis.severity, dis.rank]
    );
  }

  // Save mitigations
  for (const mit of mlResult.mitigations) {
    await pool.query(
      `INSERT INTO mitigations (assessment_id, action, urgency_rank, category, disease_ref)
       VALUES ($1,$2,$3,$4,$5)`,
      [assessment.id, mit.action, mit.urgency_rank, mit.category, mit.disease_ref]
    );
  }

  // Fire alert without blocking the response
  generateAssessmentAlert({
    userId: req.user.id,
    farmId: farm_id,
    flockId: flock.id,
    assessmentId: assessment.id,
    riskLevel: finalLevel,
    farmName: farm.name,
    flockName: flock.name,
  }).catch(console.error);

  // Fetch complete assessment to return
  const full = await getAssessmentById(assessment.id);
  const { rows: updatedFlock } = await pool.query('SELECT flock_size FROM flocks WHERE id=$1', [flock.id]);
  res.status(201).json({
    assessment: full,
    weather,
    death_count: deathCount,
    updated_flock_size: updatedFlock[0]?.flock_size ?? flock.flock_size,
  });
}

async function getAssessmentById(id) {
  const { rows } = await pool.query('SELECT * FROM risk_assessments WHERE id=$1', [id]);
  if (!rows.length) return null;
  const assessment = rows[0];

  const { rows: diseases } = await pool.query(
    'SELECT * FROM disease_predictions WHERE assessment_id=$1 ORDER BY probability DESC',
    [id]
  );
  const { rows: mitigations } = await pool.query(
    'SELECT * FROM mitigations WHERE assessment_id=$1 ORDER BY urgency_rank',
    [id]
  );
  return { ...assessment, diseases, mitigations };
}

async function getAssessments(req, res) {
  const { farmId, flockId, limit = 20, offset = 0 } = req.query;
  let query = `
    SELECT ra.*, f.name as farm_name, fl.name as flock_name
    FROM risk_assessments ra
    JOIN farms f ON f.id = ra.farm_id
    LEFT JOIN flocks fl ON fl.id = ra.flock_id
    WHERE f.user_id = $1
  `;
  const params = [req.user.id];

  if (farmId) { params.push(farmId); query += ` AND ra.farm_id = $${params.length}`; }
  if (flockId) { params.push(flockId); query += ` AND ra.flock_id = $${params.length}`; }

  query += ` ORDER BY ra.assessed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await pool.query(query, params);
  res.json({ assessments: rows });
}

async function getAssessment(req, res) {
  const full = await getAssessmentById(req.params.id);
  if (!full) return res.status(404).json({ error: 'Assessment not found' });
  res.json({ assessment: full });
}

async function completeMitigation(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `UPDATE mitigations SET is_completed=$1, completed_at=CASE WHEN $1 THEN NOW() ELSE NULL END
     WHERE id=$2 RETURNING *`,
    [true, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Mitigation not found' });
  res.json({ mitigation: rows[0] });
}

module.exports = { createAssessment, getAssessments, getAssessment, completeMitigation };
