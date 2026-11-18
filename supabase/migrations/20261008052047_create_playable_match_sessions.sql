/*
# Create playable match sessions

1. New Tables
- `playable_match_sessions` stores the current live match for the single-player career.
- `id` is the stable session key.
- `club_id` identifies the manager's club.
- `match_payload` stores the live score, quarter, tactics, instructions, rotations, advice, and event log.
- `updated_at` records the most recent save time.

2. Security
- Every session belongs to one signed-in account. Unowned sessions from older
  installs are retained but cannot be accessed through the API.
- The public anon role has no table access.
*/

CREATE TABLE IF NOT EXISTS playable_match_sessions (
  id text PRIMARY KEY,
  club_id integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  match_payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE playable_match_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE playable_match_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE playable_match_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE playable_match_sessions TO authenticated;

DROP POLICY IF EXISTS "Public can read playable match session" ON playable_match_sessions;
DROP POLICY IF EXISTS "Owners can read playable match sessions" ON playable_match_sessions;
CREATE POLICY "Owners can read playable match sessions"
ON playable_match_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can create playable match session" ON playable_match_sessions;
DROP POLICY IF EXISTS "Owners can create playable match sessions" ON playable_match_sessions;
CREATE POLICY "Owners can create playable match sessions"
ON playable_match_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can update playable match session" ON playable_match_sessions;
DROP POLICY IF EXISTS "Owners can update playable match sessions" ON playable_match_sessions;
CREATE POLICY "Owners can update playable match sessions"
ON playable_match_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can delete playable match session" ON playable_match_sessions;
DROP POLICY IF EXISTS "Owners can delete playable match sessions" ON playable_match_sessions;
CREATE POLICY "Owners can delete playable match sessions"
ON playable_match_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
