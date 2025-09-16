-- Add contact fields to badges (minimal, non-breaking)
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_badges_email ON badges(email);
CREATE INDEX IF NOT EXISTS ix_badges_phone ON badges(phone);
