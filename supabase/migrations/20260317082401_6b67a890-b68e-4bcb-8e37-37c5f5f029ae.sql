DROP POLICY IF EXISTS "Anyone can create access request" ON public.access_requests;

CREATE POLICY "Anyone can create access request"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(full_name)) BETWEEN 2 AND 120
  AND length(trim(email)) BETWEEN 5 AND 255
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND (company IS NULL OR length(trim(company)) <= 120)
  AND (message IS NULL OR length(trim(message)) <= 1200)
  AND status = 'pending'
);