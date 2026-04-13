-- Seed mirror questions into the mirror_questions table
-- Run after 001_initial_schema.sql

INSERT INTO mirror_questions (id, text, dimension, anchor_low, anchor_high) VALUES
  (gen_random_uuid(), 'How adventurous is {player} when it comes to trying new things?', 'openness', 'Sticks to what they know', 'First to try anything'),
  (gen_random_uuid(), 'How creative is {player}?', 'openness', 'Practical, by-the-book', 'Full of wild ideas'),
  (gen_random_uuid(), 'How open is {player} to changing their mind?', 'openness', 'Once decided, that''s it', 'Always reconsidering'),
  (gen_random_uuid(), 'How curious is {player} about things outside their usual world?', 'openness', 'Happy in their lane', 'Into everything'),
  (gen_random_uuid(), 'How likely is {player} to pick the weird option on a menu?', 'openness', 'Butter chicken every time', 'Whatever sounds strangest'),

  (gen_random_uuid(), 'How organized is {player}''s life?', 'conscientiousness', 'Beautiful chaos', 'Everything has a system'),
  (gen_random_uuid(), 'How reliable is {player} when they say they''ll do something?', 'conscientiousness', 'Intentions are good, follow-through... less so', 'If they said it, it''s happening'),
  (gen_random_uuid(), 'How much does {player} plan ahead vs. wing it?', 'conscientiousness', 'Plans are suggestions', 'Has a spreadsheet for everything'),
  (gen_random_uuid(), 'How punctual is {player}?', 'conscientiousness', 'IST (Indian Stretchable Time)', 'Arrives before the host'),
  (gen_random_uuid(), 'How disciplined is {player} about finishing what they start?', 'conscientiousness', '27 half-finished projects', 'Sees everything through'),

  (gen_random_uuid(), 'How much does {player} light up a room when they walk in?', 'extraversion', 'Ninja entrance', 'Everyone notices'),
  (gen_random_uuid(), 'How energized does {player} get from being around people?', 'extraversion', 'Needs alone time to recharge', 'People ARE the recharge'),
  (gen_random_uuid(), 'How likely is {player} to start a conversation with a stranger?', 'extraversion', 'Would rather not', 'Already best friends with the waiter'),
  (gen_random_uuid(), 'How loud is {player} in a group?', 'extraversion', 'You have to lean in to hear them', 'You can hear them from the next room'),
  (gen_random_uuid(), 'How comfortable is {player} being the center of attention?', 'extraversion', 'Actively avoids it', 'Born for the spotlight'),

  (gen_random_uuid(), 'How likely is {player} to go along with what the group wants?', 'agreeableness', 'My way or the highway', 'Whatever makes everyone happy'),
  (gen_random_uuid(), 'How empathetic is {player}?', 'agreeableness', 'Tough love approach', 'Feels what you feel'),
  (gen_random_uuid(), 'How likely is {player} to avoid conflict?', 'agreeableness', 'Will say the uncomfortable thing', 'Peacekeeper at all costs'),
  (gen_random_uuid(), 'How generous is {player} with their time for others?', 'agreeableness', 'Protects their time fiercely', 'Drops everything to help'),
  (gen_random_uuid(), 'How trusting is {player} of new people?', 'agreeableness', 'Trust is earned slowly', 'Trusts until proven wrong'),

  (gen_random_uuid(), 'How chill is {player} under pressure?', 'stability', 'Stress spiral incoming', 'Ice in their veins'),
  (gen_random_uuid(), 'How much does {player} overthink things?', 'stability', 'Decides and moves on', 'Still thinking about that thing from 2019'),
  (gen_random_uuid(), 'How quickly does {player} bounce back from a bad day?', 'stability', 'Carries it for a while', 'Already over it by dinner'),
  (gen_random_uuid(), 'How easily does {player} get frustrated?', 'stability', 'Fuse is... short', 'Nothing bothers them'),
  (gen_random_uuid(), 'How much does {player} worry about what others think of them?', 'stability', 'Could not care less', 'Replays every conversation')
ON CONFLICT DO NOTHING;
