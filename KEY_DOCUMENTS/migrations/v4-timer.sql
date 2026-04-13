-- v4-timer migration
-- Run in Supabase SQL Editor after v4.sql
--
-- Stores the server-side timestamp when the session was paused.
-- Eliminates reliance on client-provided paused_at for the resume offset calculation.
-- Null means the session is not currently paused (or was paused before this migration).

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;
