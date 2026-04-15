const pool = require('../db/db');
const {
  streamChat,
  generateAssessmentNarrative,
  askEncyclopedia,
  clearSession,
  buildFarmContext,
  isPoultryRelated,
  OFF_TOPIC_REPLY,
} = require('../services/claudeService');

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchFarmContext(userId, farmId) {
  // Farm (verify ownership)
  const { rows: farmRows } = await pool.query(
    'SELECT * FROM farms WHERE id=$1 AND user_id=$2 AND is_active=true',
    [farmId, userId]
  );
  if (!farmRows.length) return null;
  const farm = farmRows[0];

  // Latest active flock with computed age
  const { rows: flockRows } = await pool.query(
    `SELECT *,
       GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - hatch_date)) / 604800))::int AS age_weeks
     FROM flocks
     WHERE farm_id=$1 AND is_active=true
     ORDER BY updated_at DESC LIMIT 1`,
    [farmId]
  );
  const flock = flockRows[0] || null;

  // Latest assessment with diseases and mitigations
  let assessment = null;
  const { rows: aRows } = await pool.query(
    `SELECT * FROM risk_assessments WHERE farm_id=$1 ORDER BY assessed_at DESC LIMIT 1`,
    [farmId]
  );
  if (aRows.length) {
    assessment = { ...aRows[0], diseases: [], mitigations: [] };

    const { rows: dRows } = await pool.query(
      'SELECT * FROM disease_predictions WHERE assessment_id=$1 ORDER BY rank ASC',
      [assessment.id]
    );
    assessment.diseases = dRows;

    const { rows: mRows } = await pool.query(
      'SELECT * FROM mitigations WHERE assessment_id=$1 ORDER BY urgency_rank ASC',
      [assessment.id]
    );
    assessment.mitigations = mRows;
  }

  // Weather from latest assessment snapshot
  let weather = null;
  if (assessment) {
    weather = {
      temperature: assessment.temperature,
      humidity: assessment.humidity,
      rainfall: assessment.rainfall,
      season: assessment.season,
    };
  }

  // Unread alerts
  const { rows: alertRows } = await pool.query(
    `SELECT * FROM alerts
     WHERE user_id=$1 AND is_read=false
     ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );

  return { farm, flock, assessment, weather, alerts: alertRows };
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
async function chat(req, res) {
  const { message, sessionId, farmId } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Pre-filter: reject off-topic messages without calling Claude (zero API cost)
  if (!isPoultryRelated(message)) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ delta: OFF_TOPIC_REPLY })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  }

  // Set SSE headers immediately
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    let farmContext = '';
    if (farmId) {
      const ctx = await fetchFarmContext(req.user.id, farmId);
      if (ctx) farmContext = buildFarmContext(ctx);
    }

    const sid = sessionId || `${req.user.id}-default`;

    for await (const delta of streamChat({
      sessionId: sid,
      userMessage: message,
      farmContext,
    })) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      // Flush if available (some Node.js response implementations support this)
      if (typeof res.flush === 'function') res.flush();
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'AI service error' });
    }
    res.write(`data: ${JSON.stringify({ error: 'AI response failed. Please try again.' })}\n\n`);
    res.end();
  }
}

// ── POST /api/ai/narrative ────────────────────────────────────────────────────
async function narrative(req, res) {
  const { assessmentId, farmId } = req.body;
  if (!assessmentId || !farmId) {
    return res.status(400).json({ error: 'assessmentId and farmId are required' });
  }

  try {
    const ctx = await fetchFarmContext(req.user.id, farmId);
    if (!ctx) return res.status(404).json({ error: 'Farm not found' });

    // If a specific assessment was requested and it differs from the latest, fetch it
    if (ctx.assessment?.id !== assessmentId) {
      const { rows } = await pool.query(
        'SELECT * FROM risk_assessments WHERE id=$1 AND farm_id=$2',
        [assessmentId, farmId]
      );
      if (rows.length) {
        ctx.assessment = { ...rows[0], diseases: [], mitigations: [] };
        const { rows: dRows } = await pool.query(
          'SELECT * FROM disease_predictions WHERE assessment_id=$1 ORDER BY rank ASC',
          [assessmentId]
        );
        ctx.assessment.diseases = dRows;
        ctx.weather = {
          temperature: rows[0].temperature,
          humidity: rows[0].humidity,
          rainfall: rows[0].rainfall,
          season: rows[0].season,
        };
      }
    }

    const text = await generateAssessmentNarrative(ctx);
    res.json({ narrative: text });
  } catch (err) {
    console.error('Narrative generation error:', err);
    res.status(500).json({ error: 'Failed to generate narrative' });
  }
}

// ── POST /api/ai/encyclopedia ─────────────────────────────────────────────────
async function encyclopedia(req, res) {
  const { question, diseaseName } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  // A diseaseName being set means the user is on a disease page — always allow.
  // For free-text questions with no disease context, apply the topic filter.
  if (!diseaseName && !isPoultryRelated(question)) {
    return res.json({ answer: OFF_TOPIC_REPLY });
  }

  try {
    const answer = await askEncyclopedia({ question: question.trim(), diseaseName });
    res.json({ answer });
  } catch (err) {
    console.error('Encyclopedia AI error:', err);
    res.status(500).json({ error: 'Failed to get AI answer' });
  }
}

// ── POST /api/ai/chat/clear ───────────────────────────────────────────────────
async function clearChatSession(req, res) {
  const { sessionId } = req.body;
  if (sessionId) clearSession(sessionId);
  res.json({ cleared: true });
}

module.exports = { chat, narrative, encyclopedia, clearChatSession };
