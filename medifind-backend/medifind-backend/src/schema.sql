-- MediFind database schema (SQLite)
-- All money amounts are stored in the smallest currency unit (cents/paisa) as integers.
-- Never store money as floating point — rounding errors compound fast.

CREATE TABLE IF NOT EXISTS doctors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  specialty         TEXT NOT NULL,
  license_number    TEXT NOT NULL,
  clinic_name       TEXT,
  fee_cents         INTEGER NOT NULL DEFAULT 0,      -- default consultation fee
  is_verified       INTEGER NOT NULL DEFAULT 0,       -- 0/1, set true after manual review
  payout_method     TEXT,                             -- 'bank_transfer' | 'jazzcash' | 'easypaisa'
  payout_details    TEXT,                             -- account/wallet number, stored as JSON string
  balance_owed_cents INTEGER NOT NULL DEFAULT 0,       -- what MediFind currently owes this doctor
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id         INTEGER NOT NULL REFERENCES doctors(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  scheduled_at      TEXT NOT NULL,
  fee_cents         INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment | confirmed | completed | cancelled
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id        INTEGER NOT NULL REFERENCES appointments(id),
  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount_cents          INTEGER NOT NULL,
  platform_fee_cents    INTEGER NOT NULL,
  doctor_share_cents    INTEGER NOT NULL,
  status                TEXT NOT NULL DEFAULT 'created', -- created | paid | failed | refunded
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id         INTEGER NOT NULL REFERENCES doctors(id),
  amount_cents      INTEGER NOT NULL,
  method            TEXT NOT NULL,
  reference         TEXT,                              -- bank/wallet transaction reference once sent
  status            TEXT NOT NULL DEFAULT 'pending',    -- pending | sent | failed
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payouts_doctor ON payouts(doctor_id);
