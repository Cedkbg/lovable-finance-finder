
-- Favorites table
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.financial_assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enable realtime for favorites
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorites;
