'use strict';

const pool = require('../config/db');
const { sendEnquiryEmails } = require('../services/emailService');

/**
 * POST /api/enquiries
 * Saves a new contact form enquiry to MySQL and fires notification emails.
 */
async function createEnquiry(req, res, next) {
  const { name, email, subject, message } = req.body;

  // Capture submitter metadata for audit trail
  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const user_agent = req.headers['user-agent']?.substring(0, 512) || null;

  let conn;
  try {
    conn = await pool.getConnection();

    const [result] = await conn.execute(
      `INSERT INTO enquiries (name, email, subject, message, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, subject, message, ip_address, user_agent]
    );

    const enquiryId = result.insertId;

    // Fetch the full row so we have created_at for the email
    const [rows] = await conn.execute(
      `SELECT id, name, email, subject, message, created_at FROM enquiries WHERE id = ?`,
      [enquiryId]
    );

    conn.release();

    const enquiry = rows[0];
    console.log(`[ENQUIRY] New enquiry #${enquiryId} saved — from: ${email}`);

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
    if (conn) conn.release();
    next(err);
  }
}

/**
 * GET /api/enquiries
 * Returns a paginated list of all enquiries (for internal/admin use).
 * Supports ?page=1&limit=20&status=new query params.
 */
async function listEnquiries(req, res, next) {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const status = req.query.status || null;
  const offset = (page - 1) * limit;

  let conn;
  try {
    conn = await pool.getConnection();

    const whereClause = status ? 'WHERE status = ?' : '';
    const params      = status ? [status, limit, offset] : [limit, offset];

    const [rows] = await conn.execute(
      `SELECT id, name, email, subject, LEFT(message, 120) AS message_preview,
              status, ip_address, created_at, updated_at
       FROM enquiries
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM enquiries ${whereClause}`,
      status ? [status] : []
    );

    conn.release();

    const total = countRows[0].total;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (conn) conn.release();
    next(err);
  }
}

/**
 * GET /api/enquiries/:id
 * Returns a single enquiry by ID and marks it as 'read' if it was 'new'.
 */
async function getEnquiry(req, res, next) {
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) {
    return res.status(400).json({ success: false, message: 'Invalid enquiry ID.' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT * FROM enquiries WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      conn.release();
      return res.status(404).json({ success: false, message: `Enquiry #${id} not found.` });
    }

    // Auto-mark as read
    if (rows[0].status === 'new') {
      await conn.execute(
        `UPDATE enquiries SET status = 'read' WHERE id = ? AND status = 'new'`,
        [id]
      );
    }

    conn.release();

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (conn) conn.release();
    next(err);
  }
}

/**
 * PATCH /api/enquiries/:id/status
 * Updates the workflow status of an enquiry.
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

  let conn;
  try {
    conn = await pool.getConnection();

    const [result] = await conn.execute(
      `UPDATE enquiries SET status = ? WHERE id = ?`,
      [status, id]
    );

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: `Enquiry #${id} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: `Enquiry #${id} status updated to '${status}'.`,
    });
  } catch (err) {
    if (conn) conn.release();
    next(err);
  }
}

module.exports = { createEnquiry, listEnquiries, getEnquiry, updateEnquiryStatus };
