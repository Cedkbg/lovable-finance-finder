
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

-- Create unique index on ISIN
CREATE UNIQUE INDEX idx_financial_assets_isin ON public.financial_assets (isin);
-- Create index on ticker for fast lookup
CREATE INDEX idx_financial_assets_ticker ON public.financial_assets (ticker);
CREATE INDEX idx_financial_assets_symbol ON public.financial_assets (symbol);

-- Enable RLS (public read, insert allowed for all since no auth required for this tool)
ALTER TABLE public.financial_assets ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "Anyone can read financial assets"
ON public.financial_assets FOR SELECT
USING (true);

-- Allow anyone to insert (enricher tool - no auth needed)
CREATE POLICY "Anyone can insert financial assets"
ON public.financial_assets FOR INSERT
WITH CHECK (true);

-- Allow anyone to update
CREATE POLICY "Anyone can update financial assets"
ON public.financial_assets FOR UPDATE
USING (true);

-- Trigger for updated_at
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
