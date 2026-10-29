-- Create the scan history table used by the app's local-first cloud sync.
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_mode TEXT,
  backend TEXT,
  analysed_anyway BOOLEAN NOT NULL DEFAULT false,
  reported BOOLEAN NOT NULL DEFAULT false,
  ranked JSONB NOT NULL DEFAULT '[]'::jsonb,
  threshold NUMERIC,
  temperature NUMERIC,
  margin NUMERIC,
  latency_ms NUMERIC,
  problems TEXT[] NOT NULL DEFAULT '{}'
);

-- Add sync fields if scan_history was created earlier with the basic schema.
ALTER TABLE public.scan_history
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS input_mode TEXT,
  ADD COLUMN IF NOT EXISTS backend TEXT,
  ADD COLUMN IF NOT EXISTS analysed_anyway BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ranked JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS threshold NUMERIC,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC,
  ADD COLUMN IF NOT EXISTS margin NUMERIC,
  ADD COLUMN IF NOT EXISTS latency_ms NUMERIC,
  ADD COLUMN IF NOT EXISTS problems TEXT[] NOT NULL DEFAULT '{}';

-- Enforce that users can only read or change their own scan rows.
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow open access for testing" ON public.scan_history;
DROP POLICY IF EXISTS "Users can read their own scans" ON public.scan_history;
CREATE POLICY "Users can read their own scans"
  ON public.scan_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add their own scans" ON public.scan_history;
CREATE POLICY "Users can add their own scans"
  ON public.scan_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scans" ON public.scan_history;
CREATE POLICY "Users can update their own scans"
  ON public.scan_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own scans" ON public.scan_history;
CREATE POLICY "Users can delete their own scans"
  ON public.scan_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_history TO authenticated;

-- Index the account and date columns used for per-user history lists.
CREATE INDEX IF NOT EXISTS scan_history_user_created_idx
  ON public.scan_history (user_id, created_at DESC);

-- Create a private bucket for scan thumbnails (small JPEGs).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('scan-images', 'scan-images', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg'];

-- Let authenticated users manage only files in their own UUID-named folder.
DROP POLICY IF EXISTS "Users can read their own scan images" ON storage.objects;
CREATE POLICY "Users can read their own scan images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can upload their own scan images" ON storage.objects;
CREATE POLICY "Users can upload their own scan images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can update their own scan images" ON storage.objects;
CREATE POLICY "Users can update their own scan images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can delete their own scan images" ON storage.objects;
CREATE POLICY "Users can delete their own scan images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
