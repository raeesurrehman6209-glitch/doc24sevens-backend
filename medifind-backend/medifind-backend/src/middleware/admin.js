// Minimal admin protection: the admin panel sends a token in the
// X-Admin-Token header, checked against ADMIN_TOKEN in your .env.
// This is intentionally simple for an MVP — good enough to stop randoms
// from hitting these routes, not a substitute for real admin accounts
// if MediFind grows past one or two people managing it.
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid or missing admin token' });
  }
  next();
}

module.exports = { requireAdmin };
