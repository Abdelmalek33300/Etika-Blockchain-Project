-- GO Badges 1  tables badges + badge_verifications
-- Postgres  13 recommandé

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- pour gen_random_uuid()

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_status') THEN
    CREATE TYPE badge_status AS ENUM ('requested','verified','rejected','revoked');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_action') THEN
    CREATE TYPE badge_action AS ENUM ('request','verify','reject','revoke');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id   UUID        NOT NULL,
  sector        VARCHAR(50) NOT NULL,
  status        badge_status NOT NULL DEFAULT 'requested',
  proof_json    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at   TIMESTAMPTZ,
  verifier_id   UUID,
  note          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_badges_active
  ON badges(consumer_id, sector)
  WHERE status IN ('requested','verified');

CREATE INDEX IF NOT EXISTS ix_badges_status   ON badges(status);
CREATE INDEX IF NOT EXISTS ix_badges_sector   ON badges(sector);
CREATE INDEX IF NOT EXISTS ix_badges_consumer ON badges(consumer_id);

CREATE TABLE IF NOT EXISTS badge_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  actor_id    UUID,
  action      badge_action NOT NULL,
  old_status  badge_status,
  new_status  badge_status,
  note        TEXT,
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_badge_verif_badge ON badge_verifications(badge_id);
CREATE INDEX IF NOT EXISTS ix_badge_verif_time  ON badge_verifications(created_at);

CREATE OR REPLACE FUNCTION trg_badges_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO badge_verifications(badge_id, actor_id, action, old_status, new_status, note, snapshot)
  VALUES (NEW.id, NULL, 'request', NULL, NEW.status, 'auto-log insert', jsonb_build_object('proof_json', NEW.proof_json));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_ai_badges ON badges;
CREATE TRIGGER t_ai_badges
AFTER INSERT ON badges
FOR EACH ROW EXECUTE FUNCTION trg_badges_after_insert();

CREATE OR REPLACE FUNCTION trg_badges_after_update()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_action badge_action;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
                  WHEN 'verified' THEN 'verify'
                  WHEN 'rejected' THEN 'reject'
                  WHEN 'revoked'  THEN 'revoke'
                  ELSE 'request'
                END;

    IF NEW.status = 'verified' AND NEW.verified_at IS NULL THEN
      NEW.verified_at := now();
    END IF;

    INSERT INTO badge_verifications(badge_id, actor_id, action, old_status, new_status, note, snapshot)
    VALUES (NEW.id, NEW.verifier_id, v_action, OLD.status, NEW.status, NEW.note,
            jsonb_build_object('proof_json', NEW.proof_json));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_au_badges ON badges;
CREATE TRIGGER t_au_badges
AFTER UPDATE OF status, proof_json, note, verifier_id, verified_at ON badges
FOR EACH ROW EXECUTE FUNCTION trg_badges_after_update();

CREATE OR REPLACE VIEW vw_badges_counters AS
SELECT
  COALESCE(SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END),0) AS total_badges,
  COALESCE(
    jsonb_object_agg(sector, cnt ORDER BY sector)
    FILTER (WHERE sector IS NOT NULL), '{}'::jsonb
  ) AS per_sector
FROM (
  SELECT sector, COUNT(*) FILTER (WHERE status='verified') AS cnt
  FROM badges
  GROUP BY sector
) s;
