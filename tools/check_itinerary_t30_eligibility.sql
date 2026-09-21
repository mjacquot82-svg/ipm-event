BEGIN READ ONLY;
WITH clock AS (SELECT now() AS checked_at),
event AS (SELECT id FROM public.events WHERE slug='ipm-2026'),
regs AS (SELECT r.* FROM public.itinerary_reminder_installations r JOIN event e ON e.id=r.event_id),
stars AS (SELECT s.* FROM public.itinerary_reminder_stars s JOIN regs r ON r.id=s.registration_id),
potential AS (
 SELECT i.starts_at,r.provider_checked_at FROM regs r
 JOIN stars s ON s.registration_id=r.id
 JOIN public.schedule_items i ON i.id=s.schedule_item_id AND i.event_id=r.event_id
 CROSS JOIN clock c
 LEFT JOIN public.itinerary_reminder_deliveries d ON d.registration_id=r.id AND d.schedule_item_id=i.id AND d.reminder_type='itinerary_t30'
 WHERE r.reminders_enabled AND r.provider_deliverable AND r.provider_reachability='optIn' AND r.provider_has_push_token
 AND i.status='published' AND s.starred_at<i.starts_at-interval '30 minutes'
 AND (d.id IS NULL OR (d.status='provider_failed' AND d.attempt_count<3 AND d.next_attempt_at<=c.checked_at))
)
SELECT c.checked_at,
(SELECT count(*) FROM event) AS matching_events,
(SELECT count(*) FROM regs) AS registered,
(SELECT count(*) FROM regs WHERE reminders_enabled) AS enabled,
(SELECT count(*) FROM regs WHERE provider_deliverable) AS deliverable,
(SELECT count(*) FROM stars) AS synchronized_stars,
(SELECT count(*) FROM potential p WHERE p.starts_at>c.checked_at+interval '25 minutes' AND p.starts_at<=c.checked_at+interval '30 minutes' AND p.provider_checked_at>c.checked_at-interval '15 minutes') AS eligible_right_now,
(SELECT count(*) FROM potential p WHERE p.starts_at>c.checked_at+interval '25 minutes' AND p.starts_at<=c.checked_at+interval '30 minutes') AS due_before_readiness_refresh,
(SELECT min(starts_at) FROM potential WHERE starts_at>c.checked_at+interval '25 minutes') AS next_candidate_event_start_utc,
(SELECT min(starts_at)-interval '30 minutes' FROM potential WHERE starts_at>c.checked_at+interval '25 minutes') AS next_candidate_t30_utc,
(SELECT min(starts_at) AT TIME ZONE 'America/Toronto' FROM potential WHERE starts_at>c.checked_at+interval '25 minutes') AS next_candidate_event_start_toronto,
(SELECT count(*) FROM regs WHERE wonderpush_installation_id IS NULL OR btrim(wonderpush_installation_id)='' OR position('@' in wonderpush_installation_id)>0 OR position(',' in wonderpush_installation_id)>0) AS unsafe_target_rows,
(SELECT count(*) FROM public.itinerary_reminder_deliveries d JOIN regs r ON r.id=d.registration_id) AS deliveries
FROM clock c;
COMMIT;
