-- 0027_event_show_on_planner.sql
--
-- Weekly Planner: event-level curation instead of calendar/person filtering.
--
-- The Planner page originally showed every event from every selected
-- calendar, same as the full Calendar page. That's too noisy for a
-- print-style weekly-at-a-glance view — the point is to see the handful of
-- "highlight" activities (practice, appointments), not every meeting.
--
-- `show_on_planner` is a local-only flag on the event itself (never synced
-- back to the source calendar, same as pending_deletion): when true, the
-- event is one of the curated highlights shown on the Planner. Defaults to
-- false so existing events don't flood the page the moment this ships;
-- events created directly from the Planner's "Add activity" flow default it
-- to true instead, since adding one there is an explicit intent to see it.

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_on_planner boolean NOT NULL DEFAULT false;
