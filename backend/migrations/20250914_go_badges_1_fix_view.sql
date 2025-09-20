-- Fix vw_badges_counters: total global + détail par secteur (badges vérifiés)
DROP VIEW IF EXISTS vw_badges_counters;

CREATE OR REPLACE VIEW vw_badges_counters AS
SELECT
  (SELECT COUNT(*) FROM badges WHERE status = 'verified')::bigint AS total_badges,
  COALESCE(
    (SELECT jsonb_object_agg(sector, cnt ORDER BY sector)
       FROM (
         SELECT sector, COUNT(*) AS cnt
         FROM badges
         WHERE status = 'verified'
         GROUP BY sector
       ) t
    ),
    '{}'::jsonb
  ) AS per_sector;