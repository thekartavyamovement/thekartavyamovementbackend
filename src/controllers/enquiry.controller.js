'use strict';

/**
 * Enquiry controller — fully driver-agnostic.
 *
 * This file NEVER imports mysql2 or pg directly.
 * All database access goes through the unified adapter in src/config/db.js,
 * which routes to the correct driver (MySQL or PostgreSQL) based on DB_DRIVER.
 *
 * SQL fragments are built by db.getSql() so dialect differences (placeholders,
 * RETURNING, LEFT vs SUBSTRING, COUNT casting, etc.) are handled transparently.
 */

const db = require('../config/db');
const { sendEnquiryEmails } = require('../services/emailService');

// ── POST /api/enquiries ────────────────────────────────────────────────────
/**
 * Save a new contact form enquiry and fire notification emails.
 */
async function createEnquiry(req, res, next) {
  const { name, email, subject, message } = req.body;
  const sql = db.getSql();

  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const user_agent = req.headers['user-agent']?.substring(0, 512) || null;

  let client;
  try {
    client = await db.getClient();

    // Insert the row ─────────────────────────────────────────────────────────
    const insertResult = await client.query(sql.INSERT_ENQUIRY, [
      name, email, subject, message, ip_address, user_agent,
    ]);

    // PostgreSQL: insertId comes from RETURNING id (first row)
    // MySQL:      insertId comes from OkPacket.insertId
    const enquiryId = insertResult.insertId;

    // Fetch full row for email (has created_at) ───────────────────────────────
    const selectResult = await client.query(sql.SELECT_BY_ID, [enquiryId]);
    client.release();

    const enquiry = selectResult.rows[0];
    console.log(`[ENQUIRY] #${enquiryId} saved (${db.driver}) — from: ${email}`);

    // Fire emails asynchronously — don't block the HTTP response
    sendEnquiryEmails(enquiry).catch((err) => {
      console.error('[ENQUIRY] Async email error:', err.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out. We will get back to you soon.',
      data: { id: enquiryId },
    });
  } catch (err) {
    if (client) client.release();
    next(err);
  }
}

// ── GET /api/enquiries ─────────────────────────────────────────────────────
/**
 * Paginated list of enquiries.
 * Query params: ?page=1 &limit=20 &status=new
 */
async function listEnquiries(req, res, next) {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const status = req.query.status || null;
  const offset = (page - 1) * limit;
  const sql    = db.getSql();

  let client;
  try {
    client = await db.getClient();

    // Build param arrays — status comes first when present
    const listParams  = status ? [status, limit, offset] : [limit, offset];
    const countParams = status ? [status] : [];

    const [listResult, countResult] = await Promise.all([
      client.query(sql.SELECT_PAGE(!!status), listParams),
      client.query(sql.COUNT(!!status),       countParams),
    ]);

    client.release();

    const total = sql.getTotal(countResult.rows[0]);

    return res.status(200).json({
      success: true,
      data: listResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (client) client.release();
    next(err);
  }
}

// ── GET /api/enquiries/:id ─────────────────────────────────────────────────
/**
 * Fetch a single enquiry. Auto-marks 'new' → 'read' on first view.
 */
async function getEnquiry(req, res, next) {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ success: false, message: 'Invalid enquiry ID.' });
  }

  const sql = db.getSql();
  let client;

  try {
    client = await db.getClient();

    const { rows } = await client.query(sql.SELECT_BY_ID, [id]);

    if (!rows.length) {
      client.release();
      return res.status(404).json({ success: false, message: `Enquiry #${id} not found.` });
    }

    if (rows[0].status === 'new') {
      await client.query(sql.MARK_READ, [id]);
    }

    client.release();

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (client) client.release();
    next(err);
  }
}

// ── PATCH /api/enquiries/:id/status ───────────────────────────────────────
/**
 * Update the workflow status of an enquiry.
 * Body: { "status": "replied" }
 */
async function updateEnquiryStatus(req, res, next) {
  const id     = parseInt(req.params.id, 10);
  const { status } = req.body;
  const validStatuses = ['new', 'read', 'replied', 'archived'];

  if (!id || id < 1) {
    return res.status(400).json({ success: false, message: 'Invalid enquiry ID.' });
  }
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
    });
  }

  const sql = db.getSql();
  let client;

  try {
    client = await db.getClient();

    const result = await client.query(sql.UPDATE_STATUS, [status, id]);
    client.release();

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: `Enquiry #${id} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: `Enquiry #${id} status updated to '${status}'.`,
    });
  } catch (err) {
    if (client) client.release();
    next(err);
  }
}

module.exports = { createEnquiry, listEnquiries, getEnquiry, updateEnquiryStatus };
