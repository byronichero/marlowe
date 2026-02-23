-- Migration: Add parent_id to requirements for NIST control hierarchy (base + enhancements)
-- Run this if you have an existing database before using NIST 800-53 seed.
-- New deployments get this column via SQLAlchemy create_all.

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_requirements_parent_id ON requirements(parent_id);
