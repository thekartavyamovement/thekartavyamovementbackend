-- ============================================================
--  The Kartavya Movement — PostgreSQL Schema
--
--  Run manually:
--    psql -d kartavya_movement -f src/database/schema.postgres.sql
--
--  Or use the setup script (recommended — reads .env automatically):
--    npm run db:setup:postgres
-- ============================================================

-- ── Create database (run as superuser if the DB doesn't exist yet) ────────
-- CREATE DATABASE kartavya_movement
--   ENCODING = 'UTF8'
--   LC_COLLATE = 'en_US.UTF-8'
--   LC_CTYPE   = 'en_US.UTF-8'
--   TEMPLATE   = template0;

-- ── Status domain ─────────────────────────────────────────────────────────
-- PostgreSQL doesn't use MySQL-style ENUM columns.
-- We use a TEXT column with a CHECK constraint — easier to extend later.

-- ────────────────────────────────────────────────────────────
--  enquiries
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id           BIGSERIAL      PRIMARY KEY,
  name         VARCHAR(120)   NOT NULL,
  email        VARCHAR(254)   NOT NULL,
  subject      VARCHAR(255)   NOT NULL,
  message      TEXT           NOT NULL,
  status       TEXT           NOT NULL DEFAULT 'new'
                              CHECK (status IN ('new', 'read', 'replied', 'archived')),
  ip_address   VARCHAR(45),
  user_agent   VARCHAR(512),
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at on every row change ────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enquiries_updated_at ON enquiries;
CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON enquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_enquiries_email      ON enquiries (email);
CREATE INDEX IF NOT EXISTS idx_enquiries_status     ON enquiries (status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries (created_at DESC);

-- ── Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE  enquiries              IS 'Contact form enquiries received from the website';
COMMENT ON COLUMN enquiries.id          IS 'Primary key (auto-increment)';
COMMENT ON COLUMN enquiries.name        IS 'Submitter full name';
COMMENT ON COLUMN enquiries.email       IS 'Submitter email address';
COMMENT ON COLUMN enquiries.subject     IS 'Enquiry subject line';
COMMENT ON COLUMN enquiries.message     IS 'Full message body';
COMMENT ON COLUMN enquiries.status      IS 'Workflow status: new | read | replied | archived';
COMMENT ON COLUMN enquiries.ip_address  IS 'IPv4 or IPv6 of submitter';
COMMENT ON COLUMN enquiries.user_agent  IS 'Browser user-agent string';
