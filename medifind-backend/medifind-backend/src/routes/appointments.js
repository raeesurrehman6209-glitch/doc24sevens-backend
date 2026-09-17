const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Patient books a slot with a doctor. Nothing is charged yet — this just
// reserves the appointment as pending_payment. The frontend should
// immediately follow this with a call to POST /api/payments/checkout-session.
router.post('/', requireAuth, requireRole('patient'), (req, res) => {
  const { doctor_id, scheduled_at } = req.body;
  if (!doctor_id || !scheduled_at) {
    return res.status(400).json({ error: 'doctor_id and scheduled_at are required' });
  }

  const doctor = db.prepare('SELECT id, fee_cents, is_verified FROM doctors WHERE id = ?').get(doctor_id);
  if (!doctor || !doctor.is_verified) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const result = db
    .prepare(
      `INSERT INTO appointments (doctor_id, patient_id, scheduled_at, fee_cents, status)
       VALUES (?, ?, ?, ?, 'pending_payment')`
    )
    .run(doctor_id, req.user.id, scheduled_at, doctor.fee_cents);

  res.status(201).json({ appointment_id: result.lastInsertRowid, fee_cents: doctor.fee_cents });
});

// Patient's own appointment history
router.get('/mine', requireAuth, requireRole('patient'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.scheduled_at, a.fee_cents, a.status, d.full_name AS doctor_name, d.specialty
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_id = ? ORDER BY a.scheduled_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// Doctor's own appointment list — patient names + status, so they can see
// who's booked with them and whether payment has come through yet.
router.get('/doctor-mine', requireAuth, requireRole('doctor'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.scheduled_at, a.fee_cents, a.status, p.full_name AS patient_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       WHERE a.doctor_id = ? ORDER BY a.scheduled_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

module.exports = router;
