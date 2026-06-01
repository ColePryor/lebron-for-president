-- =====================================================================
--  DRAFT LEBRON — LeBron Ladder (ELO trivia) schema for Supabase
-- ---------------------------------------------------------------------
--  Paste this whole file into the Supabase SQL editor and run it once.
--  Design goals:
--    * Correct answers live ONLY in the questions table and are never
--      sent to the browser before a match is scored.
--    * Rating (ELO) updates happen inside SECURITY DEFINER functions, so
--      a client can't just POST itself a rating of 9999.
--    * Base tables have RLS with no policies -> no direct anon access.
--      Everything goes through the functions / read-only views below.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---- tables ---------------------------------------------------------

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),  -- private; acts as the player's token
  handle     text not null,
  rating     int  not null default 1000,
  played     int  not null default 0,
  wins       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id            int  primary key,
  prompt        text not null,
  options       jsonb not null,     -- array of option strings
  correct_index int  not null,      -- 0-based; NEVER exposed to anon
  played        int  not null default 0
);

create table if not exists public.matches (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players(id),
  question_ids     int[] not null,
  opponent_handle  text,
  opponent_rating  int  not null,
  finished         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---- row level security: lock the base tables --------------------
-- Enable RLS with NO policies => the anon/authenticated roles cannot
-- read or write these tables directly. The SECURITY DEFINER functions
-- below are owned by postgres and bypass RLS, so they are the only door.

alter table public.players   enable row level security;
alter table public.questions enable row level security;
alter table public.matches   enable row level security;

-- ---- public read-only views -------------------------------------

-- Leaderboard: handle + rating only. No ids, so nobody can grab another
-- player's token and tamper with their rating.
create or replace view public.leaderboard as
  select handle, rating, played, wins
  from public.players
  order by rating desc, played desc;

grant select on public.leaderboard to anon, authenticated;

-- ---- functions (all SECURITY DEFINER) ---------------------------

-- Join the ladder under a handle. Returns the new player's private id
-- (stored client-side as their token) plus public stats.
create or replace function public.join_ladder(p_handle text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_handle text := trim(coalesce(p_handle, ''));
  v_norm   text;
  v_id uuid;
  v_bad text[] := array[
    'fuck','shit','bitch','cunt','nigger','nigga','faggot','fag','retard',
    'rape','rapist','nazi','hitler','slut','whore','dick','cock','pussy',
    'asshole','bastard','douche','wank','twat','kike','spic','chink','coon'
  ];
  w text;
begin
  if length(v_handle) < 2 or length(v_handle) > 20 then
    raise exception 'Handle must be 2-20 characters.';
  end if;
  -- normalize: lowercase, strip everything but letters/digits, so "f.u.c.k"
  -- and "Fu_ck" still get caught.
  v_norm := lower(regexp_replace(v_handle, '[^a-z0-9]', '', 'gi'));
  foreach w in array v_bad loop
    if position(w in v_norm) > 0 then
      raise exception 'Please pick a cleaner handle.';
    end if;
  end loop;
  insert into players(handle) values (v_handle) returning id into v_id;
  return jsonb_build_object(
    'id', v_id, 'handle', v_handle, 'rating', 1000, 'played', 0, 'wins', 0
  );
end; $$;

-- Fetch a returning player's current public stats + ladder rank by token.
create or replace function public.get_player(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p players%rowtype; v_rank int; v_total int;
begin
  select * into v_p from players where id = p_id;
  if not found then return null; end if;
  select count(*) + 1 into v_rank from players where rating > v_p.rating;
  select count(*) into v_total from players;
  return jsonb_build_object(
    'id', v_p.id, 'handle', v_p.handle, 'rating', v_p.rating,
    'played', v_p.played, 'wins', v_p.wins, 'rank', v_rank, 'players', v_total
  );
end; $$;

-- Start a match: pick 5 random questions and an opponent from the ladder
-- near the player's rating. Returns questions WITHOUT correct answers.
create or replace function public.start_match(p_player_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rating int;
  v_qids int[];
  v_oh text;
  v_or int;
  v_mid uuid;
  v_questions jsonb;
begin
  select rating into v_rating from players where id = p_player_id;
  if not found then raise exception 'Unknown player.'; end if;

  select array_agg(id) into v_qids
  from (select id from questions order by random() limit 5) s;

  if v_qids is null then raise exception 'No questions loaded.'; end if;

  -- closest-rated real opponent (excluding the player); fall back to a
  -- house opponent at the player's own rating if they're alone.
  select handle, rating into v_oh, v_or
  from players
  where id <> p_player_id
  order by abs(rating - v_rating), random()
  limit 1;
  if not found then v_oh := 'The House'; v_or := v_rating; end if;

  insert into matches(player_id, question_ids, opponent_handle, opponent_rating)
  values (p_player_id, v_qids, v_oh, v_or)
  returning id into v_mid;

  select jsonb_agg(
           jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options)
           order by array_position(v_qids, q.id)
         )
  into v_questions
  from questions q
  where q.id = any(v_qids);

  return jsonb_build_object(
    'match_id', v_mid,
    'your_rating', v_rating,
    'opponent', jsonb_build_object('handle', v_oh, 'rating', v_or),
    'questions', v_questions
  );
end; $$;

-- Finish a match: server scores the answers, runs the ELO update, marks
-- the match done (so it can't be replayed), and reveals the answers.
-- p_answers is the chosen option index per question, in question order.
create or replace function public.finish_match(p_match_id uuid, p_answers int[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_m matches%rowtype;
  v_total int;
  v_correct int := 0;
  v_rating int;
  v_new int;
  v_delta int;
  v_e numeric;
  v_s numeric;
  v_rank int;
  v_players int;
  v_results jsonb := '[]'::jsonb;
  v_qid int;
  v_ci int;
  v_ans int;
  v_ok boolean;
  i int;
begin
  select * into v_m from matches where id = p_match_id;
  if not found then raise exception 'Match not found.'; end if;
  if v_m.finished then raise exception 'Match already scored.'; end if;

  v_total := array_length(v_m.question_ids, 1);
  if array_length(p_answers, 1) is distinct from v_total then
    raise exception 'Answer count does not match the match.';
  end if;

  for i in 1 .. v_total loop
    v_qid := v_m.question_ids[i];
    select correct_index into v_ci from questions where id = v_qid;
    update questions set played = played + 1 where id = v_qid;
    v_ans := p_answers[i];
    v_ok := (v_ans = v_ci);
    if v_ok then v_correct := v_correct + 1; end if;
    v_results := v_results || jsonb_build_object(
      'id', v_qid, 'correct_index', v_ci, 'your_answer', v_ans, 'correct', v_ok
    );
  end loop;

  select rating into v_rating from players where id = v_m.player_id;

  -- ELO: your score this round is the fraction correct, played against the
  -- opponent's rating. Expected score E from the standard logistic curve.
  v_s := v_correct::numeric / v_total;
  v_e := 1.0 / (1.0 + power(10, (v_m.opponent_rating - v_rating) / 400.0));
  v_delta := round(32 * (v_s - v_e));
  v_new := v_rating + v_delta;

  update players
     set rating = v_new,
         played = played + 1,
         wins   = wins + (case when v_correct * 2 > v_total then 1 else 0 end)
   where id = v_m.player_id;

  update matches set finished = true where id = p_match_id;

  select count(*) + 1 into v_rank from players where rating > v_new;
  select count(*) into v_players from players;

  return jsonb_build_object(
    'correct', v_correct,
    'total', v_total,
    'old_rating', v_rating,
    'new_rating', v_new,
    'delta', v_delta,
    'rank', v_rank,
    'players', v_players,
    'opponent', jsonb_build_object('handle', v_m.opponent_handle, 'rating', v_m.opponent_rating),
    'results', v_results
  );
end; $$;

grant execute on function public.join_ladder(text)        to anon, authenticated;
grant execute on function public.get_player(uuid)          to anon, authenticated;
grant execute on function public.start_match(uuid)         to anon, authenticated;
grant execute on function public.finish_match(uuid, int[]) to anon, authenticated;

-- ---- seed the question bank -------------------------------------
-- 14 questions, 5 drawn per match. A bigger bank makes brute-force
-- memorization of answers slower. Edit/extend freely.

insert into public.questions (id, prompt, options, correct_index) values
  (1,  'Where was LeBron born and raised?',
       '["Akron, Ohio","Cleveland, Ohio","Miami, Florida","Los Angeles, California"]', 0),
  (2,  'In what year was LeBron drafted #1 overall?',
       '["2003","2001","2005","1999"]', 0),
  (3,  'Whose record did LeBron break in 2023 to become the NBA''s all-time leading scorer?',
       '["Kareem Abdul-Jabbar","Michael Jordan","Kobe Bryant","Karl Malone"]', 0),
  (4,  'How many NBA championships has LeBron won?',
       '["Four","Two","Three","Six"]', 0),
  (5,  'What school did LeBron open in his hometown in 2018?',
       '["The I PROMISE School","King James Prep","The Chosen Academy","Akron Future School"]', 0),
  (6,  'In 2024 LeBron made NBA history by playing alongside which family member?',
       '["His son, Bronny","His brother","His father","His nephew"]', 0),
  (7,  'LeBron has played for every team below EXCEPT one. Which?',
       '["Chicago Bulls","Cleveland Cavaliers","Miami Heat","Los Angeles Lakers"]', 0),
  (8,  'Which high school did LeBron attend?',
       '["St. Vincent–St. Mary","Oak Hill Academy","Akron Central","Mater Dei"]', 0),
  (9,  'What jersey number does LeBron currently wear for the Lakers?',
       '["23","6","32","3"]', 0),
  (10, 'How many Olympic gold medals has LeBron won in men''s basketball (through 2024)?',
       '["Three","One","Two","Four"]', 0),
  (11, 'What is the name of LeBron''s media and production company?',
       '["The SpringHill Company","Klutch Sports","Roc Nation","Fenway Sports"]', 0),
  (12, 'In what year did LeBron win his first NBA championship?',
       '["2012","2010","2016","2009"]', 0),
  (13, 'Which team did LeBron play for first in the NBA?',
       '["Cleveland Cavaliers","Miami Heat","Los Angeles Lakers","Toronto Raptors"]', 0),
  (14, 'How many NBA Finals MVP awards has LeBron won?',
       '["Four","Two","Three","One"]', 0)
on conflict (id) do update
  set prompt = excluded.prompt,
      options = excluded.options,
      correct_index = excluded.correct_index;
