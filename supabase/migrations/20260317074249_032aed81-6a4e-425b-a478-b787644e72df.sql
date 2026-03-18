
-- Create financial_assets table
CREATE TABLE public.financial_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  isin TEXT NOT NULL,
  sector TEXT,
  acf TEXT,
  ric TEXT,
  ticker TEXT,
  symbol TEXT,
  country_id TEXT,
  country TEXT,
  mic_code TEXT,
  currency_id TEXT,
  currency TEXT,
  description TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_financial_assets_isin ON public.financial_assets (isin);
CREATE INDEX idx_financial_assets_ticker ON public.financial_assets (ticker);
CREATE INDEX idx_financial_assets_symbol ON public.financial_assets (symbol);

ALTER TABLE public.financial_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read financial assets"
ON public.financial_assets FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert financial assets"
ON public.financial_assets FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update financial assets"
ON public.financial_assets FOR UPDATE
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_financial_assets_updated_at
BEFORE UPDATE ON public.financial_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
