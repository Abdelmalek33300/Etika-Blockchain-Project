-- Corrige verified_at : utiliser un BEFORE UPDATE + backfill

-- 1) BEFORE UPDATE : si on passe à 'verified' et que verified_at est NULL, on le renseigne.
CREATE OR REPLACE FUNCTION trg_badges_before_update_set_verified_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'verified'
     AND (OLD.status IS DISTINCT FROM 'verified')
     AND NEW.verified_at IS NULL THEN
    NEW.verified_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_bu_set_verified_at ON badges;
CREATE TRIGGER t_bu_set_verified_at
BEFORE UPDATE OF status ON badges
FOR EACH ROW EXECUTE FUNCTION trg_badges_before_update_set_verified_at();

-- 2) AFTER UPDATE (journalisation) : ne fait QUE logger, ne touche plus NEW.*
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

-- 3) Backfill : renseigner verified_at pour les badges déjà 'verified'
UPDATE badges
   SET verified_at = COALESCE(verified_at, now())
 WHERE status = 'verified' AND verified_at IS NULL;