-- Contact form messages from the home page. Visitors can add a row; nobody can read, change or delete rows through the API.
-- Read them in the Supabase dashboard (Table Editor). If you re-run schema.sql, run this file again afterwards.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(btrim(message)) between 1 and 2000)
);

alter table public.contact_messages enable row level security;

drop policy if exists "anyone can send a message" on public.contact_messages;
create policy "anyone can send a message" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
