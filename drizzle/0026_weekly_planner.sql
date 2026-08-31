-- 0026_weekly_planner.sql
--
-- Weekly Planner page: a print-style weekly view (meals + activities per day,
-- a Mon-Sun goal/habit checkbox grid, and a freeform weekly note).
--
-- 1. `weekly_planner_notes` — one freeform note per week, keyed by the Monday
--    date (matches meals.week_of so both features agree on week boundaries).
--
-- 2. `weekly_habits` / `weekly_habit_checks` — the habit definition persists
--    across weeks; only the daily checks are dated. This mirrors how
--    meals.date is the stable identity for meals (migration 0020) rather than
--    a week-relative (week_of, day_of_week) pair, so a habit's history
--    survives a "week starts on" preference change.

CREATE TABLE IF NOT EXISTS weekly_planner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of date NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_planner_notes_week_of_idx ON weekly_planner_notes(week_of);

CREATE TABLE IF NOT EXISTS weekly_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label varchar(255) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_habits_sort_order_idx ON weekly_habits(sort_order);

CREATE TABLE IF NOT EXISTS weekly_habit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES weekly_habits(id) ON DELETE CASCADE,
  date date NOT NULL,
  checked boolean NOT NULL DEFAULT true,
  checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_habit_checks_habit_date_idx ON weekly_habit_checks(habit_id, date);
CREATE INDEX IF NOT EXISTS weekly_habit_checks_date_idx ON weekly_habit_checks(date);
