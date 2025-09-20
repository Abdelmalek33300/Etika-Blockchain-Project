DROP VIEW IF EXISTS vw_badges_counters;

DROP TRIGGER IF EXISTS t_au_badges ON badges;
DROP TRIGGER IF EXISTS t_ai_badges ON badges;

DROP FUNCTION IF EXISTS trg_badges_after_update();
DROP FUNCTION IF EXISTS trg_badges_after_insert();

DROP TABLE IF EXISTS badge_verifications;
DROP TABLE IF EXISTS badges;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_action') THEN
    DROP TYPE badge_action;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_status') THEN
    DROP TYPE badge_status;
  END IF;
END $$;
