CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notif_log (id TEXT PRIMARY KEY, sent_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS integrations (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS raw_activities (id TEXT PRIMARY KEY, source TEXT NOT NULL, json TEXT NOT NULL, fetched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS strava_activities (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_strava_updated ON strava_activities(updated_at);
-- V5 : comptes, sessions, état par utilisateur, sauvegardes. Les tables historiques restent intactes.
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, device TEXT, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS user_state (user_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS state_backups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL, created_at INTEGER NOT NULL, reason TEXT);
CREATE INDEX IF NOT EXISTS idx_backups_user ON state_backups(user_id, id);
CREATE TABLE IF NOT EXISTS coach_usage (user_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (user_id, day));
