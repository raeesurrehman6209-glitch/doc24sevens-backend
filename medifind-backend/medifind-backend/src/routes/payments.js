const express = require('express');
const Stripe = require('stripe');
const { db, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.12');

// ── 1. Patient starts payment for a booked appointment ──────
// Frontend calls this after POST /api/appointments succeeds, then
// redirects the browser to the returned Stripe Checkout URL.
router.post('/checkout-session', express.json(), requireAuth, requireRole('patient'), async (req, res) => {
  const { appointment_id } = req.body;

  const appointment = db
    .prepare(
      `SELECT a.*, d.full_name AS doctor_name FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ? AND a.patient_id = ?`
    )
    .get(appointment_id, req.user.id);

  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (appointment.status !== 'pending_payment') {
    return res.status(400).json({ error: `Appointment is already ${appointment.status}` });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'pkr',
          unit_amount: appointment.fee_cents,
          product_data: { name: `Consultation with Dr. ${appointment.doctor_name}` }
        },
        quantity: 1
      }
    ],
    // We record the appointment id on the session itself so the webhook
    // knows exactly what this payment is for — no guessing later.
    metadata: { appointment_id: String(appointment.id) },
    success_url: `${process.env.FRONTEND_ORIGIN}/booking-confirmed.html?appointment=${appointment.id}`,
    cancel_url: `${process.env.FRONTEND_ORIGIN}/booking-cancelled.html?appointment=${appointment.id}`
  });

  db.prepare(
    `INSERT INTO payments (appointment_id, stripe_session_id, amount_cents, platform_fee_cents, doctor_share_cents, status)
     VALUES (?, ?, ?, ?, ?, 'created')`
  ).run(
    appointment.id,
    session.id,
    appointment.fee_cents,
    Math.round(appointment.fee_cents * COMMISSION_RATE),
    appointment.fee_cents - Math.round(appointment.fee_cents * COMMISSION_RATE)
  );

  res.json({ checkout_url: session.url });
});

// ── 2. Stripe confirms payment succeeded ─────────────────────
// This route needs the RAW request body to verify Stripe's signature,
// so it's mounted with express.raw() in server.js — not express.json().
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const payment = db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get(session.id);
    if (payment && payment.status !== 'paid') {
      withTransaction(() => {
        db.prepare(
          `UPDATE payments SET status = 'paid', stripe_payment_intent = ? WHERE id = ?`
        ).run(session.payment_intent, payment.id);

        db.prepare(`UPDATE appointments SET status = 'confirmed' WHERE id = ?`).run(payment.appointment_id);

        const appointment = db.prepare('SELECT doctor_id FROM appointments WHERE id = ?').get(payment.appointment_id);
        db.prepare('UPDATE doctors SET balance_owed_cents = balance_owed_cents + ? WHERE id = ?').run(
          payment.doctor_share_cents,
          appointment.doctor_id
        );
      });
      console.log(`Payment confirmed for appointment ${payment.appointment_id}`);
    }
  }

  res.json({ received: true });
});

module.exports = router;
