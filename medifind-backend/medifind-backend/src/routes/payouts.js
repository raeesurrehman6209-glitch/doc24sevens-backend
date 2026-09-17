const express = require('express');
const { db, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();
router.use(requireAdmin);

// ── Admin: list every doctor currently owed money ────────────
router.get('/pending', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, full_name, email, balance_owed_cents, payout_method, payout_details
       FROM doctors WHERE balance_owed_cents > 0 ORDER BY balance_owed_cents DESC`
    )
    .all();
  res.json(rows);
});

// ── Admin: mark a doctor's balance as paid out ───────────────
// This does NOT move money by itself — you send the bank transfer or
// JazzCash/Easypaisa disbursement manually (or via their API once you
// integrate one), then call this to record it and zero their balance.
router.post('/:doctorId/mark-paid', (req, res) => {
  const { doctorId } = req.params;
  const { reference } = req.body;

  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  if (doctor.balance_owed_cents <= 0) {
    return res.status(400).json({ error: 'This doctor has no outstanding balance' });
  }

  withTransaction(() => {
    db.prepare(
      `INSERT INTO payouts (doctor_id, amount_cents, method, reference, status) VALUES (?, ?, ?, ?, 'sent')`
    ).run(doctor.id, doctor.balance_owed_cents, doctor.payout_method || 'bank_transfer', reference || null);

    db.prepare('UPDATE doctors SET balance_owed_cents = 0 WHERE id = ?').run(doctor.id);
  });

  res.json({ ok: true, paid_cents: doctor.balance_owed_cents });
});

module.exports = router;
