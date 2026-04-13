-- V3 Migration — Run in Supabase SQL Editor before deploying v3
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS guards)

-- ─────────────────────────────────────────────
-- New table: packs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  energy_type text NOT NULL, -- 'warmup' | 'revealing' | 'chaotic' | 'savage'
  description text,
  source text DEFAULT 'preloaded',
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- New table: question_events (analytics hooks)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  round_id uuid REFERENCES rounds(id) ON DELETE SET NULL,
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'shown' | 'picked' | 'skipped' | 'completed'
  energy_type text,
  pack_id uuid REFERENCES packs(id) ON DELETE SET NULL,
  round_number integer,
  recorded_at timestamptz DEFAULT now()
);

-- If question_events already exists in your DB (created before this fix), run these:
ALTER TABLE question_events ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES rounds(id) ON DELETE SET NULL;
ALTER TABLE question_events ADD COLUMN IF NOT EXISTS energy_type text;
ALTER TABLE question_events ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES packs(id) ON DELETE SET NULL;
ALTER TABLE question_events ADD COLUMN IF NOT EXISTS round_number integer;

-- ─────────────────────────────────────────────
-- Modify table: questions
-- ─────────────────────────────────────────────
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES packs(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS energy_type text;
-- Note: 'category' column is kept for backwards compatibility, not used in v3 app logic

-- ─────────────────────────────────────────────
-- Modify table: sessions
-- ─────────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES packs(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS preset text; -- 'party' | 'custom'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES sessions(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS acquisition_source text;
-- 'status' column already exists; 'paused' is now a valid value alongside 'lobby' | 'active' | 'ended'

-- ─────────────────────────────────────────────
-- Modify table: players
-- ─────────────────────────────────────────────
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_token uuid DEFAULT gen_random_uuid();

-- ─────────────────────────────────────────────
-- Note: rounds.question_id already exists from v2
-- ─────────────────────────────────────────────
-- If for any reason it doesn't exist in your DB, uncomment:
-- ALTER TABLE rounds ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES questions(id);

-- ─────────────────────────────────────────────
-- Enforce one target answer per round
-- ─────────────────────────────────────────────
ALTER TABLE target_answers ADD CONSTRAINT IF NOT EXISTS target_answers_round_id_key UNIQUE (round_id);
