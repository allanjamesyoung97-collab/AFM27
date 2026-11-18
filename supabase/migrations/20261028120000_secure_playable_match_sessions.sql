-- Existing installs may have applied the earlier public policies. Keep any old
-- anonymous rows in place, but make them inaccessible and require account-owned
-- sessions for all future writes.
ALTER TABLE public.playable_match_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.playable_match_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.playable_match_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.playable_match_sessions TO authenticated;

DROP POLICY IF EXISTS "Public can read playable match session" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Public can create playable match session" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Public can update playable match session" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Public can delete playable match session" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Owners can read playable match sessions" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Owners can create playable match sessions" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Owners can update playable match sessions" ON public.playable_match_sessions;
DROP POLICY IF EXISTS "Owners can delete playable match sessions" ON public.playable_match_sessions;

CREATE POLICY "Owners can read playable match sessions"
  ON public.playable_match_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Owners can create playable match sessions"
  ON public.playable_match_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update playable match sessions"
  ON public.playable_match_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete playable match sessions"
  ON public.playable_match_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

