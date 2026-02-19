-- =============================================================================
-- 00_extensions.sql — Required PostgreSQL extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Crypto functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN indexes on scalar types
