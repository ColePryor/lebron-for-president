# LeBron Ladder — backend setup (Supabase)

The trivia is a live, global ELO ladder. Ratings and the correct answers
live on the server so the rankings can't be trivially cheated. It needs a
free Supabase project. ~5 minutes.

## 1. Create the project
1. Go to https://supabase.com → sign up (free tier is plenty).
2. **New project** → pick a name + a database password → create. Wait ~1 min for it to provision.

## 2. Load the schema
1. In the project, open **SQL Editor → New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
   This creates the tables, the ELO functions, the read-only leaderboard
   view, locks the base tables with row-level security, and seeds the
   question bank.

## 3. Grab your keys
1. **Project Settings → API**.
2. Copy the **Project URL** (e.g. `https://abcd1234.supabase.co`).
3. Copy the **`anon` / `public`** API key (NOT the `service_role` key).

Both are safe to expose in client-side code — the `anon` key only has the
access we granted (calling the functions + reading the leaderboard view).
Never put the `service_role` key in the site.

## 4. Wire up the site
1. Open `config.js` in the repo root and fill in the two values:
   ```js
   window.LADDER_CONFIG = {
     url: "https://abcd1234.supabase.co",
     anonKey: "eyJhbGc...your-anon-key..."
   };
   ```
2. Commit + push. GitHub Pages redeploys in ~1 min and the ladder goes live.

Until `config.js` is filled in, the trivia section shows a friendly
"ladder isn't connected yet" notice instead of breaking.

## How a match works
- A player claims a handle → starts at rating **1000**.
- Each match = **5 random questions** (drawn from a 14-question bank) against
  a real opponent pulled from the ladder near their rating (or "The House"
  at their own rating if they're the first player).
- The server scores the answers, runs the ELO update (K-factor 32), and
  returns the new rating + global rank. The leaderboard updates live.

## Notes / hardening (optional, later)
- **Question bank:** add more rows to `questions` in `schema.sql` (or via
  the table editor) to slow down answer-memorization. 5 are drawn per match.
- **Handles aren't unique** and there's no login, so display names can
  collide and anyone can pick any handle. The player's real identity is a
  private UUID stored in their browser. For a fan novelty this is fine; if
  it matters later, add Supabase anonymous auth and key players to `auth.uid()`.
- **Abuse ceiling:** rating moves at most ±32 per match, so even a determined
  cheater climbs slowly. Add per-IP rate limiting (Supabase Edge Function or
  a reverse proxy) if it ever gets targeted.
