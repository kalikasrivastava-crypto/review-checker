-- Analysis summaries: one row each time an analysis finishes on /analyse.
-- Stores counts only. No review text, no reviewer names, no file name.
-- Run this once in the Supabase SQL editor. If you ever re-run schema.sql, run this file again afterwards,
-- because schema.sql revokes table access from the anonymous role at its end.

create table if not exists public.analysis_summaries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  review_count integer not null check (review_count between 1 and 5000),
  data_source text not null check (data_source in ('sample', 'upload')),
  -- {"food": {"mentions": 76, "positive": 42, "negative": 20, "mixed": 14}, ...}
  theme_counts jsonb not null check (jsonb_typeof(theme_counts) = 'object' and pg_column_size(theme_counts) < 2000),
  -- [{"rank": 1, "theme": "Service speed", "concerned_reviews": 44}, ...] (at most 3)
  top_priorities jsonb not null check (jsonb_typeof(top_priorities) = 'array' and jsonb_array_length(top_priorities) <= 3 and pg_column_size(top_priorities) < 1000)
);

alter table public.analysis_summaries enable row level security;

-- Insert only. There is deliberately no select, update or delete policy, so nobody can read rows through the API.
-- Read them yourself in the Supabase dashboard (Table Editor or SQL editor), which bypasses these rules.
drop policy if exists "anyone can add a summary" on public.analysis_summaries;
create policy "anyone can add a summary" on public.analysis_summaries
  for insert to anon, authenticated
  with check (true);

revoke all on public.analysis_summaries from anon, authenticated;
grant insert on public.analysis_summaries to anon, authenticated;
