'use strict';

const express = require('express');
const router  = express.Router();

const {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiryStatus,
} = require('../controllers/enquiry.controller');

const {
  enquiryLimiter,
  enquiryValidationRules,
  handleValidationErrors,
} = require('../middleware/validateEnquiry');

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/enquiries
//  Submit a new contact form enquiry.
//  Rate-limited to 5 requests per IP per 10 minutes.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  enquiryLimiter,
  enquiryValidationRules,
  handleValidationErrors,
  createEnquiry
);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/enquiries
//  List all enquiries with pagination.
//  Query params: ?page=1&limit=20&status=new
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', listEnquiries);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/enquiries/:id
//  Fetch a single enquiry (auto-marks 'new' → 'read').
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', getEnquiry);

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/enquiries/:id/status
//  Update the workflow status of an enquiry.
//  Body: { "status": "replied" | "archived" | "read" | "new" }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', updateEnquiryStatus);

module.exports = router;
