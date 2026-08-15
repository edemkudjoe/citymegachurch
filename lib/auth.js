const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// Middleware-style helper for serverless functions.
// Returns the decoded user, or sends a 401 response and returns null.
function requireAuth(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'No authorization token provided.' });
    return null;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return null;
  }
  return decoded;
}

function requireAdmin(req, res) {
  const decoded = requireAuth(req, res);
  if (!decoded) return null;
  if (decoded.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }
  return decoded;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Basic CORS handling, restricted to configured origin (matches BizTrack pattern)
function applyCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // caller should return immediately
  }
  return false;
}

module.exports = {
  signToken,
  verifyToken,
  getTokenFromRequest,
  requireAuth,
  requireAdmin,
  hashPassword,
  comparePassword,
  applyCors,
};
