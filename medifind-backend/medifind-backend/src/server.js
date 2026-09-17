require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');

const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const paymentRoutes = require('./routes/payments');
const payoutRoutes = require('./routes/payouts');

// Make sure the tables exist before we start accepting requests.
initSchema();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));

// IMPORTANT: the Stripe webhook route needs the raw request body to verify
// its signature, so it must be mounted BEFORE express.json() runs on it.
// payments.js applies express.raw() only to /webhook internally, but that
// only works if the global express.json() below hasn't already consumed
// the body — so we mount payments.js before the global json parser.
app.use('/api/payments', paymentRoutes);

// Every other route gets normal JSON body parsing.
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payouts', payoutRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MediFind API running on http://localhost:${PORT}`);
});
