-- Encrypted, anonymous snapshots for optional cross-device sync.
-- `id` is SHA-256("gymmiie-id:" + normalized sync code); `payload` is
-- base64(iv + AES-GCM ciphertext). The Worker never receives plaintext.
CREATE TABLE IF NOT EXISTS sync_snapshots (
  id         TEXT PRIMARY KEY NOT NULL,
  payload    TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  bytes      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_snapshots_updated_at
  ON sync_snapshots (updated_at);
