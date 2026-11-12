-- A random salt per normalized name allows unique name/PIN pairs without
-- retaining the plaintext PIN, including for accounts that share a name.
CREATE TABLE IF NOT EXISTS account_pin_salts (
  normalized_name TEXT PRIMARY KEY NOT NULL,
  salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_pins (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL REFERENCES account_pin_salts(normalized_name),
  pin_hash TEXT NOT NULL,
  UNIQUE (normalized_name, pin_hash)
);
