-- ============================================================
--  The Kartavya Movement — Database Schema
--  Run: mysql -u <user> -p < src/database/schema.sql
--  Or use:  npm run db:setup  (recommended — uses .env creds)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `kartavya_movement`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `kartavya_movement`;

-- ────────────────────────────────────────────────────────────
--  enquiries
--  Every contact form submission is stored here.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id           INT UNSIGNED   NOT NULL AUTO_INCREMENT        COMMENT 'Primary key',
  name         VARCHAR(120)   NOT NULL                       COMMENT 'Submitter full name',
  email        VARCHAR(254)   NOT NULL                       COMMENT 'Submitter email address',
  subject      VARCHAR(255)   NOT NULL                       COMMENT 'Enquiry subject line',
  message      TEXT           NOT NULL                       COMMENT 'Full message body',
  status       ENUM(
                 'new',       -- just received, not yet read
                 'read',      -- opened in admin view
                 'replied',   -- a reply has been sent
                 'archived'   -- closed / no further action needed
               )              NOT NULL DEFAULT 'new'         COMMENT 'Workflow status',
  ip_address   VARCHAR(45)    NULL                           COMMENT 'IPv4 or IPv6 of submitter',
  user_agent   VARCHAR(512)   NULL                           COMMENT 'Browser user-agent string',
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY  (id),
  INDEX idx_email      (email),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Contact form enquiries received from the website';
