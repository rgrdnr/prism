-- Travel expenses: itemized cost line items for budgeting a trip
CREATE TABLE IF NOT EXISTS travel_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  category varchar(20) NOT NULL DEFAULT 'other',
  description varchar(255) NOT NULL,
  amount decimal(10,2) NOT NULL,
  date date,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_expenses_trip_id_idx ON travel_expenses(trip_id);
