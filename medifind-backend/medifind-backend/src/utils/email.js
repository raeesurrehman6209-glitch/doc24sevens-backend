// Sends transactional email via Resend's REST API.
// Uses plain fetch (built into Node 18+) so no extra npm install is needed.
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_API_URL = 'https://api.resend.com/emails';

// onboarding@resend.dev works immediately with any Resend account for testing —
// no domain verification needed. Swap in a verified sender (e.g. no-reply@yourdomain.com)
// once you've verified a domain in the Resend dashboard, before going live.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'MediFind <onboarding@resend.dev>';

async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in .env');
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Reset your MediFind password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f766e;">Reset your password</h2>
          <p>We got a request to reset the password on your MediFind account.</p>
          <p>
            <a href="${resetUrl}"
               style="display:inline-block; background:#0f766e; color:#fff; padding:12px 20px;
                      border-radius:8px; text-decoration:none; font-weight:600;">
              Reset Password
            </a>
          </p>
          <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return res.json();
}

module.exports = { sendPasswordResetEmail };