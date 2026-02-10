-- Marlowe PostgreSQL init (extensions, grants). Tables created by app via SQLAlchemy.
-- Use this when the DB is created manually; Docker can run this as init script.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional: create role and DB if not exists (adjust for your setup):
-- CREATE USER marlowe WITH PASSWORD 'marlowe';
-- CREATE DATABASE marlowe OWNER marlowe;
-- GRANT ALL PRIVILEGES ON DATABASE marlowe TO marlowe;
