const jwt = require('jsonwebtoken');

// Reads the "Authorization: Bearer <token>" header, verifies the JWT
// (signed in routes/auth.js's signToken), and attaches the decoded
// { id, role } payload to req.user for downstream routes to use.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Use after requireAuth on routes that only one role should access,
// e.g. router.get('/me/balance', requireAuth, requireRole('doctor'), ...)
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `This action requires the '${role}' role` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };