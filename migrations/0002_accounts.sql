-- Name + international telephone is intentionally the only sign-in identity.
-- Registration is gated separately by a Worker secret; no shared secret is stored.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  telephone TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (normalized_name, telephone)
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_sessions_expiry ON account_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_account_sessions_account ON account_sessions(account_id);

CREATE TABLE IF NOT EXISTS account_snapshots (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payload TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER,
  last_commit_id TEXT
);

-- Small receipts, rather than full old snapshots, make an uncertain PUT retry safe.
CREATE TABLE IF NOT EXISTS account_commits (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  commit_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, commit_id)
);

CREATE TABLE IF NOT EXISTS account_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_rate_limits_expiry ON account_rate_limits(expires_at);
