-- Create access requests table for users who prefer manual onboarding
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate pending requests for same email
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_email_idx
ON public.access_requests (lower(email))
WHERE status = 'pending';

-- Enable row level security
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit an access request, but keep rows non-readable by default
DROP POLICY IF EXISTS "Anyone can create access request" ON public.access_requests;
CREATE POLICY "Anyone can create access request"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Keep updated_at fresh on future status updates
DROP TRIGGER IF EXISTS update_access_requests_updated_at ON public.access_requests;
CREATE TRIGGER update_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();