const pool = require('../db/db');

async function getAlerts(req, res) {
  const { type, unread_only, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT a.*, f.name as farm_name, fl.name as flock_name
    FROM alerts a
    LEFT JOIN farms f ON f.id = a.farm_id
    LEFT JOIN flocks fl ON fl.id = a.flock_id
    WHERE a.user_id = $1
  `;
  const params = [req.user.id];

  if (type) { params.push(type); query += ` AND a.type = $${params.length}`; }
  if (unread_only === 'true') { query += ` AND a.is_read = false`; }

  query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await pool.query(query, params);
  const { rows: counts } = await pool.query(
    'SELECT COUNT(*) FROM alerts WHERE user_id=$1 AND is_read=false',
    [req.user.id]
  );
  res.json({ alerts: rows, unread_count: parseInt(counts[0].count) });
}

async function dismissAlert(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    'UPDATE alerts SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Alert not found' });
  res.json({ message: 'Alert dismissed' });
}

async function markAllRead(req, res) {
  await pool.query(
    'UPDATE alerts SET is_read=true WHERE user_id=$1 AND is_read=false',
    [req.user.id]
  );
  res.json({ message: 'All alerts marked as read' });
}

module.exports = { getAlerts, dismissAlert, markAllRead };
