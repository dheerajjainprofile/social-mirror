-- v4 migration — distinguish "didn't answer" from explicit "passed"
-- Run in Supabase SQL Editor. Idempotent.

-- When calculate-winner runs for a round, any player who never submitted a
-- guess gets an auto-created guess row with passed=true AND auto_passed=true.
-- This lets the UI/badges tell the two apart without breaking existing scoring
-- logic (scoring already treats all passed=true rows as 0 points).
ALTER TABLE guesses
  ADD COLUMN IF NOT EXISTS auto_passed boolean NOT NULL DEFAULT false;
