-- DineTrust database: tables, Row Level Security, live updates and the few functions guests and demo visitors use.
-- Run this once in Supabase -> SQL Editor, then run seed.sql to add the Demo Restaurant template.

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  phone text not null default '',
  email text not null default '',
  settings jsonb not null,
  google_review_url text not null default '',
  is_demo boolean not null default false,
  is_template boolean not null default false,
  records_version bigint not null default 0,
  bills_file text not null default '',
  reservations_file text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index restaurants_one_per_owner on public.restaurants (owner_id) where owner_id is not null;

create table public.bills (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  bill_no text not null default '',
  date text not null,
  minutes int not null,
  party_size int not null,
  items text not null default ''
);
create index bills_restaurant_idx on public.bills (restaurant_id, bill_no);

create table public.reservations (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ref text not null default '',
  date text not null,
  minutes int not null,
  party_size int not null
);
create index reservations_restaurant_idx on public.reservations (restaurant_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  demo_key text,
  author text not null default 'Added review',
  rating smallint not null check (rating between 1 and 5),
  date text not null,
  text text not null,
  source text not null default 'added' check (source in ('demo', 'added')),
  status text not null default 'new' check (status in ('new', 'checked', 'replied', 'reported')),
  note text,
  replied_at timestamptz,
  reported_at timestamptz,
  claims jsonb,
  claims_hash text,
  created_at timestamptz not null default now()
);
create index reviews_restaurant_idx on public.reviews (restaurant_id, date desc);

create table public.case_reports (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  result jsonb not null,
  sig text not null,
  checked_at timestamptz not null default now()
);
create index case_reports_restaurant_idx on public.case_reports (restaurant_id);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  key text not null,
  text text not null,
  warning text,
  source text,
  at timestamptz not null default now(),
  unique (review_id, key)
);
create index replies_restaurant_idx on public.replies (restaurant_id);

create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  visit_date text,
  visit_time text,
  party_size int,
  bill_no text,
  comment text not null default '',
  name text,
  phone text,
  verified_visit boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
create index customer_feedback_restaurant_idx on public.customer_feedback (restaurant_id, created_at desc);

-- Row Level Security: an owner only ever sees rows of their own restaurant.
alter table public.restaurants enable row level security;
alter table public.bills enable row level security;
alter table public.reservations enable row level security;
alter table public.reviews enable row level security;
alter table public.case_reports enable row level security;
alter table public.replies enable row level security;
alter table public.customer_feedback enable row level security;

create policy "owner reads restaurant" on public.restaurants for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner updates restaurant" on public.restaurants for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes restaurant" on public.restaurants for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner all bills" on public.bills for all to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner all reservations" on public.reservations for all to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner all reviews" on public.reviews for all to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner all case_reports" on public.case_reports for all to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner all replies" on public.replies for all to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
-- Guests never read or write this table directly; the owner reads and manages it.
create policy "owner reads feedback" on public.customer_feedback for select to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner updates feedback" on public.customer_feedback for update to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())))
  with check (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));
create policy "owner deletes feedback" on public.customer_feedback for delete to authenticated
  using (restaurant_id in (select id from public.restaurants where owner_id = (select auth.uid())));

-- Owners can change only the harmless columns of their restaurant row.
revoke insert, update on public.restaurants from authenticated, anon;
grant update (name, phone, email, settings, google_review_url, records_version, bills_file, reservations_file, updated_at) on public.restaurants to authenticated;
revoke update on public.customer_feedback from authenticated, anon;
grant update (status) on public.customer_feedback to authenticated;

-- Live updates
alter table public.reviews replica identity full;
alter table public.case_reports replica identity full;
alter table public.replies replica identity full;
alter table public.customer_feedback replica identity full;
alter publication supabase_realtime add table public.reviews, public.case_reports, public.replies, public.customer_feedback;

-- Helpers
create function public.make_slug(p_name text) returns text
language plpgsql set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  base := trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'restaurant'; end if;
  base := left(base, 40);
  candidate := base;
  while exists (select 1 from public.restaurants where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

create function public.create_restaurant(p_settings jsonb, p_google text default '')
returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.restaurants; nm text := left(trim(coalesce(p_settings->>'name', '')), 80);
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if nm = '' then raise exception 'Restaurant name is required'; end if;
  if exists (select 1 from public.restaurants where owner_id = uid) then raise exception 'You already have a restaurant'; end if;
  insert into public.restaurants (owner_id, slug, name, phone, email, settings, google_review_url)
  values (uid, public.make_slug(nm), nm, left(coalesce(p_settings->>'phone', ''), 40), left(coalesce(p_settings->>'email', ''), 80), p_settings, left(coalesce(p_google, ''), 400))
  returning * into r;
  return r;
end $$;

create function public.fill_demo(p_restaurant uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t uuid := (select id from public.restaurants where is_template);
begin
  insert into public.reviews (restaurant_id, demo_key, author, rating, date, text, source, claims)
    select p_restaurant, demo_key, author, rating, date, text, source, claims from public.reviews where restaurant_id = t;
  insert into public.bills (restaurant_id, bill_no, date, minutes, party_size, items)
    select p_restaurant, bill_no, date, minutes, party_size, items from public.bills where restaurant_id = t;
  insert into public.reservations (restaurant_id, ref, date, minutes, party_size)
    select p_restaurant, ref, date, minutes, party_size from public.reservations where restaurant_id = t;
end $$;
revoke execute on function public.fill_demo(uuid) from public, anon, authenticated;

create function public.seed_demo_restaurant() returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.restaurants; t public.restaurants;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into t from public.restaurants where is_template;
  insert into public.restaurants (owner_id, slug, name, phone, email, settings, is_demo)
  values (uid, 'demo-restaurant-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6), 'Demo Restaurant', t.phone, t.email, t.settings, true)
  on conflict (owner_id) where owner_id is not null do nothing
  returning * into r;
  if r.id is null then select * into r from public.restaurants where owner_id = uid; return r; end if;
  perform public.fill_demo(r.id);
  return r;
end $$;

create function public.reset_demo() returns public.restaurants
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.restaurants; t public.restaurants;
begin
  select * into r from public.restaurants where owner_id = uid and is_demo;
  if r.id is null then raise exception 'Only a demo restaurant can be reset'; end if;
  select * into t from public.restaurants where is_template;
  delete from public.reviews where restaurant_id = r.id;
  delete from public.bills where restaurant_id = r.id;
  delete from public.reservations where restaurant_id = r.id;
  delete from public.customer_feedback where restaurant_id = r.id;
  update public.restaurants set name = 'Demo Restaurant', phone = t.phone, email = t.email, settings = t.settings,
    google_review_url = '', records_version = records_version + 1, bills_file = '', reservations_file = '', updated_at = now()
    where id = r.id returning * into r;
  perform public.fill_demo(r.id);
  return r;
end $$;

-- What a guest's page may know: the restaurant's name and Google link, nothing else.
create function public.public_restaurant(p_slug text)
returns table (name text, google_review_url text)
language sql stable security definer set search_path = '' as $$
  select r.name, r.google_review_url from public.restaurants r where r.slug = p_slug and not r.is_template;
$$;

-- A guest's feedback. The bill number is checked here, in the database; no bill detail is returned.
create function public.submit_feedback(
  p_slug text, p_rating int, p_visit_date text, p_visit_time text, p_party_size int,
  p_bill_no text, p_comment text, p_name text, p_phone text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rid uuid; ok_bill boolean := false; bn text := nullif(trim(coalesce(p_bill_no, '')), '');
begin
  select id into rid from public.restaurants where slug = p_slug and not is_template;
  if rid is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('ok', false, 'error', 'bad_rating'); end if;
  if (select count(*) from public.customer_feedback where restaurant_id = rid and created_at > now() - interval '1 hour') >= 100 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  if bn is not null then
    ok_bill := exists (select 1 from public.bills where restaurant_id = rid and lower(bill_no) = lower(bn));
  end if;
  insert into public.customer_feedback (restaurant_id, rating, visit_date, visit_time, party_size, bill_no, comment, name, phone, verified_visit)
  values (rid, p_rating, left(p_visit_date, 10), left(p_visit_time, 5), case when p_party_size between 1 and 500 then p_party_size end,
    left(bn, 40), left(coalesce(p_comment, ''), 2000), left(nullif(trim(coalesce(p_name, '')), ''), 80), left(nullif(trim(coalesce(p_phone, '')), ''), 40), ok_bill);
  return jsonb_build_object('ok', true, 'verified', ok_bill);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.public_restaurant(text) to anon, authenticated;
grant execute on function public.submit_feedback(text, int, text, text, int, text, text, text, text) to anon, authenticated;
grant execute on function public.create_restaurant(jsonb, text) to authenticated;
grant execute on function public.seed_demo_restaurant() to authenticated;
grant execute on function public.reset_demo() to authenticated;
