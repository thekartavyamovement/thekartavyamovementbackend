'use strict';

const transporter = require('../config/mailer');

const NOTIFY_1 = process.env.NOTIFY_EMAIL_1 || 'connect@thekartavyamovement.org';
const NOTIFY_2 = process.env.NOTIFY_EMAIL_2 || 'thekartavyamovement@gmail.com';
const FROM     = process.env.FROM_EMAIL      || '"The Kartavya Movement" <thekartavyamovement@gmail.com>';

/**
 * Sends two emails for every new enquiry:
 *  1. A notification to both organisation inboxes (with all enquiry details).
 *  2. A personalised acknowledgement back to the person who submitted the form.
 *
 * Both sends are non-fatal — if email fails the enquiry is still saved to DB.
 *
 * @param {object} enquiry - { id, name, email, subject, message, created_at }
 */
async function sendEnquiryEmails(enquiry) {
  const { id, name, email, subject, message, created_at } = enquiry;
  const dateStr = new Date(created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // ── 1. Internal notification ──────────────────────────────────────────────
  const notificationHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { background: #1a3c2e; color: #fff; padding: 20px 24px; border-radius: 6px 6px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { background: #f9f9f9; padding: 24px; border: 1px solid #ddd; border-top: none; }
    .field-label { font-weight: bold; color: #555; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-value { margin: 4px 0 16px; padding: 10px 14px; background: #fff; border-left: 4px solid #1a3c2e; border-radius: 0 4px 4px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 16px; text-align: center; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📩 New Enquiry — The Kartavya Movement</h1>
    </div>
    <div class="body">
      <p>A new contact form submission has been received on the website.</p>
      <p><span class="badge">Enquiry #${id}</span> &nbsp;·&nbsp; ${dateStr} IST</p>

      <p class="field-label">Name</p>
      <div class="field-value">${name}</div>

      <p class="field-label">Email</p>
      <div class="field-value"><a href="mailto:${email}">${email}</a></div>

      <p class="field-label">Subject</p>
      <div class="field-value">${subject}</div>

      <p class="field-label">Message</p>
      <div class="field-value" style="white-space: pre-wrap;">${message}</div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 13px; color: #666;">
        Reply directly to <a href="mailto:${email}">${email}</a> or log in to the admin panel to update the status.
      </p>
    </div>
    <div class="footer">The Kartavya Movement · Automated Notification</div>
  </div>
</body>
</html>`;

  const notificationText = `
New Enquiry #${id} — The Kartavya Movement
Received: ${dateStr} IST

Name:    ${name}
Email:   ${email}
Subject: ${subject}

Message:
${message}

---
Reply to: ${email}
`;

  // ── 2. Acknowledgement to the submitter ───────────────────────────────────
  const ackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.7; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { background: #1a3c2e; color: #fff; padding: 20px 24px; border-radius: 6px 6px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { background: #fff; padding: 24px; border: 1px solid #ddd; border-top: none; }
    .quote { border-left: 4px solid #1a3c2e; padding: 10px 16px; background: #f5faf7; color: #555; font-style: italic; margin: 20px 0; }
    .footer { font-size: 12px; color: #999; margin-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank you for reaching out 🙏</h1>
    </div>
    <div class="body">
      <p>Dear ${name},</p>
      <p>
        We have received your message and will get back to you as soon as possible —
        usually within <strong>2–3 working days</strong>.
      </p>
      <div class="quote">
        <strong>Your subject:</strong> ${subject}
      </div>
      <p>
        If your matter is urgent, you can also reach us directly at
        <a href="mailto:connect@thekartavyamovement.org">connect@thekartavyamovement.org</a>.
      </p>
      <p>
        Thank you for your interest in The Kartavya Movement. Together, we can make a difference.
      </p>
      <p>Warm regards,<br><strong>The Kartavya Movement Team</strong></p>
    </div>
    <div class="footer">
      The Kartavya Movement · <a href="https://thekartavyamovement.org">thekartavyamovement.org</a>
    </div>
  </div>
</body>
</html>`;

  const ackText = `
Dear ${name},

Thank you for reaching out to The Kartavya Movement!

We have received your message (Subject: "${subject}") and will get back to you within 2–3 working days.

If your matter is urgent, email us at connect@thekartavyamovement.org.

Warm regards,
The Kartavya Movement Team
https://thekartavyamovement.org
`;

  // ── Send both emails (non-fatal) ───────────────────────────────────────────
  try {
    await transporter.sendMail({
      from: FROM,
      to: [NOTIFY_1, NOTIFY_2],
      replyTo: email,
      subject: `[New Enquiry #${id}] ${subject}`,
      text: notificationText,
      html: notificationHtml,
    });
    console.log(`[MAILER] Notification sent to ${NOTIFY_1} and ${NOTIFY_2} for enquiry #${id}`);
  } catch (err) {
    console.error(`[MAILER ERROR] Failed to send notification for enquiry #${id}:`, err.message);
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `We received your message — The Kartavya Movement`,
      text: ackText,
      html: ackHtml,
    });
    console.log(`[MAILER] Acknowledgement sent to ${email} for enquiry #${id}`);
  } catch (err) {
    console.error(`[MAILER ERROR] Failed to send acknowledgement to ${email}:`, err.message);
  }
}

module.exports = { sendEnquiryEmails };
