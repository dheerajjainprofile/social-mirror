-- Seed mirror questions into the mirror_questions table
-- Run after 001_initial_schema.sql
-- WIPE existing questions first (fresh bank)

DELETE FROM mirror_questions;

INSERT INTO mirror_questions (id, text, dimension, anchor_low, anchor_high) VALUES
  (gen_random_uuid(), 'If everyone here quit their jobs tomorrow, how likely is {player} to actually do something crazy like move to Goa?', 'openness', 'Would update their LinkedIn first', 'Already looking at flights'),
  (gen_random_uuid(), 'How likely is {player} to order something completely random off a menu they can''t read?', 'openness', 'Paneer tikka. Always.', 'Points at mystery item, no questions asked'),
  (gen_random_uuid(), 'If someone suggests a midnight road trip RIGHT NOW, how fast does {player} say yes?', 'openness', 'Needs a 3-day plan first', 'Already grabbing the car keys'),
  (gen_random_uuid(), 'How likely is {player} to completely change their opinion after a good argument?', 'openness', 'Their mind is a fortress', 'Actually, you know what, you''re right'),
  (gen_random_uuid(), 'How likely is {player} to start a random hobby that nobody asked for?', 'openness', 'Hasn''t changed since 2019', 'Has 4 half-finished hobbies right now'),

  (gen_random_uuid(), 'If the group is planning a trip, how likely is {player} to be the one with the spreadsheet?', 'conscientiousness', 'Just tell me when to show up', 'Has a color-coded itinerary'),
  (gen_random_uuid(), 'How likely is {player} to actually show up on time?', 'conscientiousness', '5 more minutes (30 min ago)', 'Arrives and judges everyone else'),
  (gen_random_uuid(), 'If {player} says "I''ll send it by tonight," what are the actual chances?', 'conscientiousness', 'You''ll get it next week. Maybe.', 'Already in your inbox'),
  (gen_random_uuid(), 'How likely is {player}''s phone to be on low battery right now?', 'conscientiousness', 'Charges at 80% just in case', 'Living on 3% and vibes'),
  (gen_random_uuid(), 'How likely is {player} to finish a Netflix series they started?', 'conscientiousness', 'Has 27 shows at episode 2', 'Finishes every series, even the bad ones'),

  (gen_random_uuid(), 'Walk into a party where {player} knows nobody. What happens in the first 10 minutes?', 'extraversion', 'Finds the dog or the bookshelf', 'Already has 3 new best friends'),
  (gen_random_uuid(), 'How likely is {player} to be the loudest person at this table right now?', 'extraversion', 'You have to lean in to hear them', 'The next table knows their opinion too'),
  (gen_random_uuid(), 'After a full day with people, how quickly does {player} need alone time?', 'extraversion', 'Was mentally done 2 hours ago', 'Why is everyone leaving already?'),
  (gen_random_uuid(), 'How likely is {player} to become friends with the auto driver / waiter / random uncle?', 'extraversion', 'Headphones in, eye contact avoided', 'Knows their life story in 5 minutes'),
  (gen_random_uuid(), 'If someone handed {player} a mic at a party, what happens?', 'extraversion', 'Physically runs away', 'Doesn''t give it back for an hour'),

  (gen_random_uuid(), 'The group can''t decide where to eat. How likely is {player} to just go along with whatever?', 'agreeableness', 'No, not there. And not there either.', 'Anything works for me!'),
  (gen_random_uuid(), 'Someone in the group is clearly upset but saying "I''m fine." How likely is {player} to actually check on them?', 'agreeableness', 'Takes I''m fine at face value', 'Already texted them privately'),
  (gen_random_uuid(), 'How likely is {player} to say the uncomfortable truth nobody else will?', 'agreeableness', 'Someone had to say it.', 'Would rather keep the peace'),
  (gen_random_uuid(), 'It''s 2 AM and {player} gets a call from a friend who needs help. What happens?', 'agreeableness', 'Phone is on DND after 11', 'Already putting on shoes'),
  (gen_random_uuid(), 'How quickly does {player} trust someone they just met?', 'agreeableness', 'Trust is earned over years', 'Trusts everyone until proven wrong'),

  (gen_random_uuid(), 'Flight is delayed by 4 hours. How does {player} react?', 'stability', 'Writing a complaint email by minute 10', 'Already found a lounge and ordered chai'),
  (gen_random_uuid(), 'How likely is {player} to still be thinking about that one embarrassing thing from 3 years ago?', 'stability', 'What embarrassing thing?', 'Replays it at 2 AM regularly'),
  (gen_random_uuid(), 'Something goes wrong at work. How fast does {player} bounce back?', 'stability', 'Carries it for days', 'That happened? Oh yeah, I''m over it'),
  (gen_random_uuid(), 'The WiFi goes out during an important call. What''s {player}''s reaction?', 'stability', 'Full meltdown, calls the ISP', 'Switches to mobile data, doesn''t blink'),
  (gen_random_uuid(), 'How much does {player} care about what random people think of them?', 'stability', 'Genuinely does not care', 'Replays every social interaction like a movie');
