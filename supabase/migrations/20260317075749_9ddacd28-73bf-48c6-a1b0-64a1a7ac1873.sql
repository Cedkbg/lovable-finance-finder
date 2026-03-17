
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  company TEXT,
  preferred_theme TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add user_id to financial_assets (nullable for backward compat with existing data)
ALTER TABLE public.financial_assets ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing seed data to be accessible to all (null user_id = public)
-- New assets will have user_id set

-- 3. Update RLS on financial_assets: users see their own + public (null user_id) assets
DROP POLICY IF EXISTS "Anyone can read financial assets" ON public.financial_assets;
DROP POLICY IF EXISTS "Anyone can insert financial assets" ON public.financial_assets;
DROP POLICY IF EXISTS "Anyone can update financial assets" ON public.financial_assets;

CREATE POLICY "Users can read own and public assets"
ON public.financial_assets FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own assets"
ON public.financial_assets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own assets"
ON public.financial_assets FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own assets"
ON public.financial_assets FOR DELETE
TO authenticated
USING (user_id = auth.uid());
