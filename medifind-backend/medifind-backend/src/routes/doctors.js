const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// Public — powers the Specialties / doctor search pages.
// Only verified doctors show up, same idea as your MediFind frontend cards.
router.get('/', (req, res) => {
  const { specialty } = req.query;
  const rows = specialty
    ? db
        .prepare(
          `SELECT id, full_name, specialty, clinic_name, fee_cents FROM doctors
           WHERE is_verified = 1 AND specialty = ? ORDER BY full_name`
        )
        .all(specialty)
    : db
        .prepare(
          `SELECT id, full_name, specialty, clinic_name, fee_cents FROM doctors
           WHERE is_verified = 1 ORDER BY full_name`
        )
        .all();
  res.json(rows);
});

// Doctor's own dashboard — how much MediFind currently owes them,
// and their payout history so far.
router.get('/me/balance', requireAuth, requireRole('doctor'), (req, res) => {
  const doctor = db
    .prepare('SELECT id, full_name, balance_owed_cents FROM doctors WHERE id = ?')
    .get(req.user.id);
  const payouts = db
    .prepare('SELECT amount_cents, method, status, created_at FROM payouts WHERE doctor_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  res.json({
    balance_owed_cents: doctor.balance_owed_cents,
    payouts
  });
});

// Doctor sets or updates where their payouts should go.
router.put('/me/payout-details', requireAuth, requireRole('doctor'), (req, res) => {
  const { payout_method, payout_details } = req.body;
  if (!['bank_transfer', 'jazzcash', 'easypaisa'].includes(payout_method)) {
    return res.status(400).json({ error: 'payout_method must be bank_transfer, jazzcash, or easypaisa' });
  }
  db.prepare('UPDATE doctors SET payout_method = ?, payout_details = ? WHERE id = ?').run(
    payout_method,
    JSON.stringify(payout_details || {}),
    req.user.id
  );
  res.json({ ok: true });
});

// ── Admin: list doctors still waiting on verification ────────
router.get('/admin/pending-verification', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, full_name, email, specialty, license_number, clinic_name, created_at
       FROM doctors WHERE is_verified = 0 ORDER BY created_at ASC`
    )
    .all();
  res.json(rows);
});

// ── Admin: approve a doctor so they appear in patient search ─
router.put('/admin/:id/verify', requireAdmin, (req, res) => {
  const result = db.prepare('UPDATE doctors SET is_verified = 1 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ ok: true });
});

module.exports = router;
