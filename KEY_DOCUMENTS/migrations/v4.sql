-- v4 migration
-- Run in Supabase SQL Editor

-- Allow the organizer/host to participate as a guesser in their own game.
-- Default false: existing sessions are unaffected.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS organizer_plays boolean NOT NULL DEFAULT false;
