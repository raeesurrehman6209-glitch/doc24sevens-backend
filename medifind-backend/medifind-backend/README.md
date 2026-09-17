# MediFind API

Backend for MediFind: patient/doctor auth, appointment booking, Stripe Checkout
payments, and a doctor payout ledger.

**Requires Node.js 24 or later** — it uses Node's built-in `node:sqlite`
module, so there's no separate database package to install and nothing to
compile. If `npm install` ever fails on some other package with a
compilation error, it's not this one.

## How the money flows

1. Patient books an appointment → `POST /api/appointments` (status: `pending_payment`)
2. Frontend immediately calls `POST /api/payments/checkout-session` → gets back a
   Stripe-hosted checkout URL → redirects the patient there
3. Patient pays on Stripe's page (you never see their card number)
4. Stripe calls your `POST /api/payments/webhook` → appointment flips to `confirmed`,
   and the doctor's `balance_owed_cents` goes up by their share (fee minus your commission)
5. Periodically (weekly/monthly, or on demand), you check `GET /api/payouts/pending`,
   send each doctor their balance via bank transfer / JazzCash / Easypaisa yourself,
   then call `POST /api/payouts/:doctorId/mark-paid` to zero their balance and log it

Doctor subscription billing isn't wired up yet — this scaffold covers the
patient-pays-doctor flow first since it's the harder of the two. Adding a
recurring Stripe subscription for doctor listing fees later is a much smaller
addition (Stripe's subscription API, not Checkout — happy to add it once
you're ready).

## Setup

```bash
cd medifind-backend
npm install
cp .env.example .env
# edit .env: add your Stripe test keys, a random JWT_SECRET, etc.
npm run init-db
npm run dev
```

Server runs at `http://localhost:4000`. Point your frontend's fetch calls at
`http://localhost:4000/api/...`.

## Testing the Stripe webhook locally

Stripe needs to reach your webhook endpoint, which `localhost` isn't
reachable from outside your machine. Use the Stripe CLI to forward events
during development:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

It'll print a `whsec_...` value — put that in your `.env` as
`STRIPE_WEBHOOK_SECRET`. In production, you'll add the real webhook URL
in the Stripe Dashboard instead and use the secret it gives you there.

## Endpoints

| Method | Path                                | Who          | What |
|--------|--------------------------------------|--------------|------|
| POST   | `/api/auth/patients/register`        | anyone       | Create patient account |
| POST   | `/api/auth/patients/login`           | anyone       | Get a patient token |
| POST   | `/api/auth/doctors/register`         | anyone       | Create doctor account (unverified) |
| POST   | `/api/auth/doctors/login`            | anyone       | Get a doctor token |
| GET    | `/api/doctors`                       | anyone       | List verified doctors, optional `?specialty=` |
| GET    | `/api/doctors/me/balance`            | doctor       | Balance owed + payout history |
| PUT    | `/api/doctors/me/payout-details`     | doctor       | Set bank/wallet payout info |
| GET    | `/api/doctors/admin/pending-verification` | admin   | Doctors awaiting license review |
| PUT    | `/api/doctors/admin/:id/verify`      | admin        | Approve a doctor so they appear in search |
| POST   | `/api/appointments`                  | patient      | Book a slot (unpaid) |
| GET    | `/api/appointments/mine`             | patient      | This patient's booking history |
| GET    | `/api/appointments/doctor-mine`      | doctor       | This doctor's appointment list |
| POST   | `/api/payments/checkout-session`     | patient      | Get a Stripe Checkout URL |
| POST   | `/api/payments/webhook`              | Stripe only  | Payment confirmation (signature-verified) |
| GET    | `/api/payouts/pending`               | admin        | Doctors currently owed money |
| POST   | `/api/payouts/:doctorId/mark-paid`   | admin        | Record a payout you sent manually |

Admin routes require an `X-Admin-Token` header matching `ADMIN_TOKEN` in your
`.env` — that's what `admin.html` asks you to type in before showing the panel.

## The frontend pages that use this API

- `login.html` — patient login, patient signup ("Sign Up as Patient" tab), and doctor login
- `join-doctor.html` — full doctor registration
- `find-doctors.html` — the real, working doctor search + booking + payment flow (specialty chips and the homepage search bar both lead here)
- `patient-dashboard.html` / `doctor-dashboard.html` — post-login dashboards
- `booking-confirmed.html` / `booking-cancelled.html` — where Stripe redirects after checkout
- `admin.html` — doctor verification + payout processing, gated by `ADMIN_TOKEN`

A doctor won't show up in `find-doctors.html` until you verify them in
`admin.html` — that's intentional, not a bug, so double-check that step if a
newly registered doctor "isn't showing up."

## What's intentionally left for you to add

- **Doctor subscription billing** — the recurring "doctors pay MediFind"
  side of things, using Stripe's Subscriptions API.
- **Refunds** — cancelling a confirmed, paid appointment currently does
  nothing to the payment. You'd call Stripe's refund API and reverse the
  doctor's balance credit.
- **Real Stripe keys** — booking will fail at the payment step until you
  put actual test keys from your Stripe dashboard into `.env`.
