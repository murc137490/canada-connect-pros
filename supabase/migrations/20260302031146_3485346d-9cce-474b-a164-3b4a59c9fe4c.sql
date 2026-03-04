
-- Drop the restrictive SELECT policy and replace with a public one for basic info
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Allow anyone to view profiles (needed for displaying pro names on public pages)
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);
