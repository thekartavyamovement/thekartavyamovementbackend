'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const enquiryRoutes = require('./routes/enquiry.routes');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// ── Validate critical env vars at startup ──────────────────────────────────
const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SMTP_USER', 'SMTP_PASS'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[STARTUP ERROR] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Trust Render's reverse proxy ───────────────────────────────────────────
// Required so express-rate-limit sees the real client IP (X-Forwarded-For)
// and req.ip is correct. Render places exactly one proxy in front of the app.
app.set('trust proxy', 1);

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  })
);

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ── Request logging ────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Global rate limiter (all routes) ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'The Kartavya Movement API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/enquiries', enquiryRoutes);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Centralised error handler ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so Render's infrastructure can reach the process.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] The Kartavya Movement API listening on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
