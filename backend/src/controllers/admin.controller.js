const pool = require('../db/db');

async function getUsers(req, res) {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { role, is_active } = req.body;

  const updates = [];
  const params = [];

  if (role !== undefined) { params.push(role); updates.push(`role=$${params.length}`); }
  if (is_active !== undefined) { params.push(is_active); updates.push(`is_active=$${params.length}`); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING id, name, email, role, is_active`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
}

async function getStats(req, res) {
  const [users, farms, assessments, images] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query('SELECT COUNT(*) FROM farms WHERE is_active=true'),
    pool.query('SELECT COUNT(*) FROM risk_assessments'),
    pool.query('SELECT COUNT(*) FROM image_analyses'),
  ]);
  res.json({
    total_users: parseInt(users.rows[0].count),
    total_farms: parseInt(farms.rows[0].count),
    total_assessments: parseInt(assessments.rows[0].count),
    total_image_analyses: parseInt(images.rows[0].count),
  });
}

module.exports = { getUsers, updateUser, getStats };
