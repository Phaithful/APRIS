const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/db');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24h
  secure: process.env.NODE_ENV === 'production',
};

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function register(req, res) {
  const { name: nameField, full_name, email, password } = req.body;
  const name = nameField || full_name;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)
     RETURNING id, name, email, role, created_at`,
    [name.trim(), email.toLowerCase().trim(), hash]
  );
  const user = rows[0];
  res.cookie('token', signToken(user), COOKIE_OPTS);
  res.status(201).json({ user });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase().trim()]
  );
  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.cookie('token', signToken(user), COOKIE_OPTS);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

function logout(req, res) {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { ...rows[0], full_name: rows[0].name } });
}

async function updateProfile(req, res) {
  const { name, email } = req.body;
  if (!name && !email) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  // If email is changing, make sure it isn't taken
  if (email) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase().trim(), req.user.id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Email already in use by another account' });
    }
  }

  const { rows } = await pool.query(
    `UPDATE users
     SET name  = COALESCE($1, name),
         email = COALESCE($2, email),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, email, role, created_at`,
    [name?.trim() || null, email?.toLowerCase().trim() || null, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });

  // Re-issue the cookie so the JWT stays consistent with the new email
  res.cookie('token', signToken(rows[0]), COOKIE_OPTS);
  res.json({ user: { ...rows[0], full_name: rows[0].name } });
}

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const { rows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(new_password, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hash, req.user.id]
  );
  res.json({ message: 'Password updated successfully' });
}

module.exports = { register, login, logout, me, updateProfile, changePassword };
