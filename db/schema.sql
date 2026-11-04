-- Click tracking table. Safe to run more than once. See docs/click-tracking.md.
CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, clicked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), page TEXT NOT NULL, section TEXT NOT NULL DEFAULT '', label TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', referrer_host TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks (clicked_at);
