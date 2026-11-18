CREATE TABLE IF NOT EXISTS public.career_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  save_id text NOT NULL,
  save_data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, save_id)
);

ALTER TABLE public.career_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.career_saves FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.career_saves TO authenticated;
DROP POLICY IF EXISTS "Users manage their own career saves" ON public.career_saves;
CREATE POLICY "Users manage their own career saves"
  ON public.career_saves FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.client_error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference text NOT NULL,
  screen text NOT NULL,
  error_name text NOT NULL,
  error_message text NOT NULL,
  component_stack text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_error_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_error_reports FROM anon, authenticated;
GRANT INSERT ON TABLE public.client_error_reports TO authenticated;
DROP POLICY IF EXISTS "Users can submit their own issue reports" ON public.client_error_reports;
CREATE POLICY "Users can submit their own issue reports"
  ON public.client_error_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS client_error_reports_created_at_idx
  ON public.client_error_reports (created_at DESC);

