'use strict';

const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter specifically for the enquiry submission endpoint.
 * 5 submissions per IP per 10 minutes prevents form spam.
 */
const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many enquiries submitted. Please wait a few minutes before trying again.',
  },
});

/**
 * Validation and sanitisation rules for the contact form payload.
 * All fields are trimmed and escaped to prevent XSS / SQL injection.
 */
const enquiryValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters.')
    .escape(),

  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email address is too long.'),

  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required.')
    .isLength({ min: 3, max: 255 }).withMessage('Subject must be between 3 and 255 characters.')
    .escape(),

  body('message')
    .trim()
    .notEmpty().withMessage('Message is required.')
    .isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters.')
    .escape(),
];

/**
 * Middleware that checks the result of validation rules and returns 422
 * with all field errors if any rule failed.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { enquiryLimiter, enquiryValidationRules, handleValidationErrors };
