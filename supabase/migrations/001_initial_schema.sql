-- Social Mirror — Complete Database Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This creates ALL tables needed for Social Mirror v1

-- ─────────────────────────────────────────────
-- Enable required extensions
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- Core tables (inherited from game engine)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  organizer_name text NOT NULL,
  scoring_mode text NOT NULL DEFAULT 'simple',
  reveal_mode text NOT NULL DEFAULT 'one-by-one',
  show_reasoning boolean NOT NULL DEFAULT false,
  hot_cold_enabled boolean NOT NULL DEFAULT true,
  timer_seconds integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'lobby',
  paused_at timestamptz,
  preset text,
  pack_id uuid,
  parent_session_id uuid REFERENCES sessions(id),
  acquisition_source text,
  organizer_plays boolean NOT NULL DEFAULT false,
  group_dynamics_result jsonb,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_organizer boolean NOT NULL DEFAULT false,
  removed boolean NOT NULL DEFAULT false,
  player_token uuid DEFAULT gen_random_uuid(),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  source text DEFAULT 'preloaded',
  approved boolean NOT NULL DEFAULT true,
  submitted_by text,
  category text,
  energy_type text,
  pack_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rounds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  target_player_id uuid NOT NULL REFERENCES players(id),
  round_number integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  winner_player_id uuid REFERENCES players(id),
  question_id uuid REFERENCES questions(id),
  started_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS target_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  answer numeric NOT NULL,
  reasoning text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT target_answers_round_id_key UNIQUE (round_id)
);

CREATE TABLE IF NOT EXISTS guesses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  answer numeric,
  reasoning text,
  passed boolean NOT NULL DEFAULT false,
  auto_passed boolean DEFAULT false,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT guesses_round_player_key UNIQUE (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  points integer NOT NULL DEFAULT 0,
  distance numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  player_name text,
  rating integer,
  comment text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  energy_type text NOT NULL,
  description text,
  source text DEFAULT 'preloaded',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  round_id uuid REFERENCES rounds(id) ON DELETE SET NULL,
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  energy_type text,
  pack_id uuid REFERENCES packs(id) ON DELETE SET NULL,
  round_number integer,
  recorded_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- NEW: Mirror tables (Social Mirror v1)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mirror_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('openness', 'conscientiousness', 'extraversion', 'agreeableness', 'stability')),
  anchor_low text,
  anchor_high text,
  weight real NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirror_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  subject_player_id uuid NOT NULL REFERENCES players(id),
  rater_player_id uuid REFERENCES players(id),
  question_id uuid NOT NULL REFERENCES mirror_questions(id),
  score integer NOT NULL CHECK (score >= 1 AND score <= 7),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT mirror_ratings_unique UNIQUE (session_id, round_number, subject_player_id, rater_player_id, question_id)
);

-- Partial unique index: prevents duplicate self-ratings (rater_player_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS mirror_ratings_self_unique
  ON mirror_ratings (session_id, round_number, subject_player_id, question_id)
  WHERE rater_player_id IS NULL;

CREATE TABLE IF NOT EXISTS mirror_portraits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  portrait_text text,
  trait_scores jsonb,
  role text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT mirror_portraits_session_player_key UNIQUE (session_id, player_id)
);

-- ─────────────────────────────────────────────
-- NEW: Player profiles (persistent identity)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id uuid NOT NULL,
  email text,
  display_name text,
  auth_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT session_profiles_unique UNIQUE (session_id, profile_id)
);

-- ─────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_rounds_session ON rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_guesses_round ON guesses(round_id);
CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_mirror_ratings_session ON mirror_ratings(session_id);
CREATE INDEX IF NOT EXISTS idx_mirror_ratings_subject ON mirror_ratings(subject_player_id);
CREATE INDEX IF NOT EXISTS idx_mirror_portraits_session ON mirror_portraits(session_id);
CREATE INDEX IF NOT EXISTS idx_session_profiles_profile ON session_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_profiles_local_id ON player_profiles(local_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room_code ON sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ─────────────────────────────────────────────
-- Enable Realtime on tables that need live updates
-- ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE target_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE mirror_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE mirror_portraits;

-- ─────────────────────────────────────────────
-- Row Level Security (RLS) — permissive for now
-- Anon key can read/write all tables (game uses no auth)
-- ─────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror_portraits ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anon access (game has no auth, uses room codes for access control)
CREATE POLICY "anon_all" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON target_answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON guesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON packs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON question_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON mirror_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON mirror_ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON mirror_portraits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON player_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON session_profiles FOR ALL USING (true) WITH CHECK (true);
