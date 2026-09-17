const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const router = express.Router();

function signToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ── Patients ──────────────────────────────────────────────

router.post('/patients/register', (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM patients WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO patients (full_name, email, password_hash) VALUES (?, ?, ?)')
    .run(full_name, email, password_hash);

  const token = signToken(result.lastInsertRowid, 'patient');
  res.status(201).json({ token, patient: { id: result.lastInsertRowid, full_name, email } });
});

router.post('/patients/login', (req, res) => {
  const { email, password } = req.body;
  const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);
  if (!patient || !bcrypt.compareSync(password, patient.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(patient.id, 'patient');
  res.json({ token, patient: { id: patient.id, full_name: patient.full_name, email: patient.email } });
});

// ── Doctors ───────────────────────────────────────────────

router.post('/doctors/register', (req, res) => {
  const { full_name, email, password, specialty, license_number, clinic_name, fee_cents } = req.body;
  if (!full_name || !email || !password || !specialty || !license_number) {
    return res.status(400).json({ error: 'full_name, email, password, specialty, and license_number are required' });
  }

  const existing = db.prepare('SELECT id FROM doctors WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO doctors (full_name, email, password_hash, specialty, license_number, clinic_name, fee_cents, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(full_name, email, password_hash, specialty, license_number, clinic_name || null, fee_cents || 0);

  // is_verified starts at 0 — flip it manually (or via an admin route you add later)
  // once you've checked the license number. Doctors shouldn't go live automatically.
  const token = signToken(result.lastInsertRowid, 'doctor');
  res.status(201).json({
    token,
    doctor: { id: result.lastInsertRowid, full_name, email, specialty, is_verified: false },
    note: 'Account created. Profile will not be publicly listed until an admin verifies the license.'
  });
});

router.post('/doctors/login', (req, res) => {
  const { email, password } = req.body;
  const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(email);
  if (!doctor || !bcrypt.compareSync(password, doctor.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(doctor.id, 'doctor');
  res.json({
    token,
    doctor: {
      id: doctor.id,
      full_name: doctor.full_name,
      email: doctor.email,
      specialty: doctor.specialty,
      is_verified: !!doctor.is_verified
    }
  });
});

module.exports = router;
