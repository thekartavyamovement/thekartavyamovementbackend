'use strict';

const nodemailer = require('nodemailer');

/**
 * Nodemailer transporter.
 * Configured for Gmail SMTP with App Password authentication.
 * For other SMTP providers, change SMTP_HOST / SMTP_PORT / SMTP_SECURE in .env.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Verify SMTP credentials at startup (non-fatal — logs the result).
 */
transporter.verify((err, success) => {
  if (err) {
    console.error('[MAILER ERROR] SMTP connection failed:', err.message);
    console.error('[MAILER ERROR] Emails will NOT be sent. Check SMTP_* vars in .env');
  } else {
    console.log('[MAILER] SMTP connection verified. Ready to send emails.');
  }
});

module.exports = transporter;
