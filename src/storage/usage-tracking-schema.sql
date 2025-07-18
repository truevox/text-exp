-- SQLite Usage Tracking Database Schemas for PuffPuffPaste
-- Two-tier system: Global (appdata) + Per-store (secondary stores)
-- Supports read-only graceful fallbacks

-- ========================================================================
-- GLOBAL USAGE TRACKING (Appdata Folder)
-- Tracks ALL snippets available to the user across ALL stores
-- ========================================================================

-- Main global usage tracking table
CREATE TABLE IF NOT EXISTS global_snippet_usage (
    id TEXT PRIMARY KEY,                    -- Snippet ID (unique across all stores)
    trigger TEXT NOT NULL,                  -- Snippet trigger (e.g., ";hello")
    preview_40 TEXT NOT NULL,              -- First 40 characters of content
    usage_count INTEGER DEFAULT 0,         -- Total times used
    first_used DATETIME,                   -- First usage timestamp (NULL if never used)
    last_used DATETIME,                    -- Last usage timestamp (NULL if never used)
    source_stores TEXT NOT NULL,          -- JSON array of store IDs where this snippet exists
    content_type TEXT DEFAULT 'plaintext', -- Content type: plaintext, html, latex
    tags TEXT,                             -- JSON array of tags
    scope TEXT DEFAULT 'personal',        -- Snippet scope: personal, team, org
    priority INTEGER DEFAULT 0,           -- Current priority (calculated from usage)
    is_read_only BOOLEAN DEFAULT 0,       -- Whether this snippet comes from read-only store
    read_only_stores TEXT,                -- JSON array of read-only store IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast trigger lookups
CREATE INDEX IF NOT EXISTS idx_global_trigger ON global_snippet_usage(trigger);

-- Index for usage count ordering (most used first)
CREATE INDEX IF NOT EXISTS idx_global_usage_count ON global_snippet_usage(usage_count DESC);

-- Index for last used ordering (recently used first)
CREATE INDEX IF NOT EXISTS idx_global_last_used ON global_snippet_usage(last_used DESC);

-- Index for scope-based queries
CREATE INDEX IF NOT EXISTS idx_global_scope ON global_snippet_usage(scope);

-- Index for read-only status queries
CREATE INDEX IF NOT EXISTS idx_global_read_only ON global_snippet_usage(is_read_only);

-- Usage events log (detailed tracking)
CREATE TABLE IF NOT EXISTS global_usage_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    snippet_id TEXT NOT NULL,
    event_type TEXT NOT NULL,              -- 'used', 'created', 'updated', 'deleted', 'read_only_attempt'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    context TEXT,                          -- Additional context (e.g., which store, trigger method)
    user_agent TEXT,                       -- Browser/extension context
    success BOOLEAN DEFAULT 1,            -- Whether the operation succeeded
    error_message TEXT,                    -- Error message if operation failed
    FOREIGN KEY (snippet_id) REFERENCES global_snippet_usage(id)
);

-- Index for event timeline queries
CREATE INDEX IF NOT EXISTS idx_global_events_timestamp ON global_usage_events(timestamp DESC);

-- Index for snippet-specific event queries
CREATE INDEX IF NOT EXISTS idx_global_events_snippet ON global_usage_events(snippet_id);

-- Index for failed operations
CREATE INDEX IF NOT EXISTS idx_global_events_errors ON global_usage_events(success, timestamp DESC);

-- Read-only access attempts tracking
CREATE TABLE IF NOT EXISTS read_only_access_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT NOT NULL,               -- Which store had read-only access attempted
    operation_type TEXT NOT NULL,         -- 'snippet_update', 'usage_track', 'db_write'
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_details TEXT,                   -- Technical error details
    fallback_used TEXT                    -- What fallback strategy was used
);

-- Index for read-only access log queries
CREATE INDEX IF NOT EXISTS idx_readonly_log_store ON read_only_access_log(store_id, attempted_at DESC);

-- ========================================================================
-- PER-STORE USAGE TRACKING (Secondary Stores)
-- Tracks ONLY snippets from specific secondary store
-- Supports multi-user collaboration scenarios
-- ========================================================================

-- Per-store usage tracking table (one DB per secondary store)
CREATE TABLE IF NOT EXISTS store_snippet_usage (
    id TEXT PRIMARY KEY,                    -- Snippet ID (unique within this store)
    trigger TEXT NOT NULL,                  -- Snippet trigger
    preview_40 TEXT NOT NULL,              -- First 40 characters of content
    usage_count INTEGER DEFAULT 0,         -- Usage count within this store context
    first_used DATETIME,                   -- First usage timestamp
    last_used DATETIME,                    -- Last usage timestamp
    user_names TEXT NOT NULL,              -- JSON array of user names who have used this
    content_type TEXT DEFAULT 'plaintext', -- Content type
    tags TEXT,                             -- JSON array of tags
    scope TEXT DEFAULT 'personal',        -- Snippet scope
    priority INTEGER DEFAULT 0,           -- Store-specific priority
    store_read_only BOOLEAN DEFAULT 0,    -- Whether the parent store is read-only
    last_sync_attempt DATETIME,           -- Last time we tried to sync this data
    sync_status TEXT DEFAULT 'synced',    -- 'synced', 'pending', 'failed', 'read_only_fallback'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store usage indexes (same structure as global)
CREATE INDEX IF NOT EXISTS idx_store_trigger ON store_snippet_usage(trigger);
CREATE INDEX IF NOT EXISTS idx_store_usage_count ON store_snippet_usage(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_store_last_used ON store_snippet_usage(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_store_scope ON store_snippet_usage(scope);
CREATE INDEX IF NOT EXISTS idx_store_sync_status ON store_snippet_usage(sync_status);

-- Store-specific usage events
CREATE TABLE IF NOT EXISTS store_usage_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    snippet_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT,                        -- Which user triggered the event
    context TEXT,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    FOREIGN KEY (snippet_id) REFERENCES store_snippet_usage(id)
);

-- Store event indexes
CREATE INDEX IF NOT EXISTS idx_store_events_timestamp ON store_usage_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_store_events_snippet ON store_usage_events(snippet_id);
CREATE INDEX IF NOT EXISTS idx_store_events_user ON store_usage_events(user_name);
CREATE INDEX IF NOT EXISTS idx_store_events_errors ON store_usage_events(success, timestamp DESC);

-- ========================================================================
-- ANALYTICS VIEWS AND COMPUTED STATISTICS
-- ========================================================================

-- Global analytics view: Most used snippets (excluding read-only issues)
CREATE VIEW IF NOT EXISTS global_most_used AS
SELECT 
    id,
    trigger,
    preview_40,
    usage_count,
    last_used,
    source_stores,
    scope,
    priority,
    is_read_only,
    read_only_stores
FROM global_snippet_usage 
WHERE usage_count > 0
ORDER BY usage_count DESC, last_used DESC;

-- Global analytics view: Recently used snippets
CREATE VIEW IF NOT EXISTS global_recently_used AS
SELECT 
    id,
    trigger,
    preview_40,
    usage_count,
    last_used,
    source_stores,
    scope,
    is_read_only
FROM global_snippet_usage 
WHERE last_used IS NOT NULL
ORDER BY last_used DESC
LIMIT 50;

-- Global analytics view: Unused snippets (candidates for cleanup)
CREATE VIEW IF NOT EXISTS global_unused_snippets AS
SELECT 
    id,
    trigger,
    preview_40,
    source_stores,
    scope,
    created_at,
    is_read_only
FROM global_snippet_usage 
WHERE usage_count = 0 OR usage_count IS NULL
ORDER BY created_at ASC;

-- Read-only access summary view
CREATE VIEW IF NOT EXISTS read_only_access_summary AS
SELECT 
    store_id,
    operation_type,
    COUNT(*) as attempt_count,
    MAX(attempted_at) as last_attempt,
    GROUP_CONCAT(DISTINCT fallback_used) as fallback_strategies
FROM read_only_access_log 
WHERE attempted_at > DATETIME('now', '-30 days')
GROUP BY store_id, operation_type
ORDER BY attempt_count DESC;

-- Store analytics view: Store-specific most used
CREATE VIEW IF NOT EXISTS store_most_used AS
SELECT 
    id,
    trigger,
    preview_40,
    usage_count,
    last_used,
    user_names,
    scope,
    priority,
    store_read_only,
    sync_status
FROM store_snippet_usage 
WHERE usage_count > 0
ORDER BY usage_count DESC, last_used DESC;

-- ========================================================================
-- TRIGGERS FOR AUTOMATIC MAINTENANCE
-- ========================================================================

-- Update global usage updated_at timestamp on usage count change
CREATE TRIGGER IF NOT EXISTS global_usage_update_timestamp
    AFTER UPDATE OF usage_count ON global_snippet_usage
BEGIN
    UPDATE global_snippet_usage 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Update store usage updated_at timestamp on usage count change
CREATE TRIGGER IF NOT EXISTS store_usage_update_timestamp
    AFTER UPDATE OF usage_count ON store_snippet_usage
BEGIN
    UPDATE store_snippet_usage 
    SET updated_at = CURRENT_TIMESTAMP,
        last_sync_attempt = CURRENT_TIMESTAMP,
        sync_status = CASE 
            WHEN NEW.store_read_only = 1 THEN 'read_only_fallback'
            ELSE 'pending'
        END
    WHERE id = NEW.id;
END;

-- Auto-calculate priority based on usage patterns (global)
-- Handles read-only scenarios gracefully
CREATE TRIGGER IF NOT EXISTS global_priority_calculation
    AFTER UPDATE OF usage_count, last_used ON global_snippet_usage
BEGIN
    UPDATE global_snippet_usage 
    SET priority = (
        -- Base priority from usage count (logarithmic scale)
        CAST(LOG10(COALESCE(NEW.usage_count, 0) + 1) * 100 AS INTEGER) +
        -- Recency bonus (max 50 points for usage within last 7 days)
        CASE 
            WHEN NEW.last_used > DATETIME('now', '-7 days') THEN 50
            WHEN NEW.last_used > DATETIME('now', '-30 days') THEN 25
            WHEN NEW.last_used > DATETIME('now', '-90 days') THEN 10
            ELSE 0
        END +
        -- Read-only penalty (slight reduction for read-only snippets)
        CASE WHEN NEW.is_read_only = 1 THEN -5 ELSE 0 END
    )
    WHERE id = NEW.id;
END;

-- Auto-calculate priority for store-specific usage
CREATE TRIGGER IF NOT EXISTS store_priority_calculation
    AFTER UPDATE OF usage_count, last_used ON store_snippet_usage
BEGIN
    UPDATE store_snippet_usage 
    SET priority = (
        CAST(LOG10(COALESCE(NEW.usage_count, 0) + 1) * 100 AS INTEGER) +
        CASE 
            WHEN NEW.last_used > DATETIME('now', '-7 days') THEN 50
            WHEN NEW.last_used > DATETIME('now', '-30 days') THEN 25
            WHEN NEW.last_used > DATETIME('now', '-90 days') THEN 10
            ELSE 0
        END +
        -- Read-only store penalty
        CASE WHEN NEW.store_read_only = 1 THEN -5 ELSE 0 END
    )
    WHERE id = NEW.id;
END;

-- ========================================================================
-- SCHEMA VERSIONING AND MIGRATION SUPPORT
-- ========================================================================

-- Schema version table
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial usage tracking schema with global and per-store tracking plus read-only support');

-- ========================================================================
-- SAMPLE QUERIES FOR COMMON ANALYTICS (WITH READ-ONLY AWARENESS)
-- ========================================================================

/*
-- Find most popular snippets across all stores (excluding read-only issues):
SELECT trigger, preview_40, usage_count, source_stores, is_read_only
FROM global_snippet_usage 
ORDER BY usage_count DESC 
LIMIT 10;

-- Find snippets that exist in multiple stores:
SELECT trigger, preview_40, usage_count, source_stores, read_only_stores
FROM global_snippet_usage 
WHERE JSON_ARRAY_LENGTH(source_stores) > 1
ORDER BY usage_count DESC;

-- Find read-only access issues in the last 7 days:
SELECT store_id, operation_type, COUNT(*) as failures
FROM read_only_access_log 
WHERE attempted_at > DATETIME('now', '-7 days')
GROUP BY store_id, operation_type
ORDER BY failures DESC;

-- Find snippets that are read-only in some stores but writable in others:
SELECT trigger, preview_40, source_stores, read_only_stores
FROM global_snippet_usage 
WHERE read_only_stores IS NOT NULL 
  AND JSON_ARRAY_LENGTH(source_stores) > JSON_ARRAY_LENGTH(read_only_stores);

-- Usage trends over time (daily) excluding failed operations:
SELECT DATE(timestamp) as date, COUNT(*) as usage_count
FROM global_usage_events 
WHERE event_type = 'used' 
  AND success = 1 
  AND timestamp > DATETIME('now', '-30 days')
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Store sync health check:
SELECT sync_status, COUNT(*) as snippet_count
FROM store_snippet_usage
GROUP BY sync_status
ORDER BY snippet_count DESC;
*/
