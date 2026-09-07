-- Run this in your Supabase project's SQL Editor (Database -> SQL Editor -> New query)

create table if not exists events (
  id text primary key,
  name text not null,
  image text,
  date date,
  start_time text,
  end_time text,
  location text,
  doc text,
  doc_name text,
  status text not null default 'upcoming'
);

create table if not exists registrations (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  name text not null,
  email text not null,
  branch text,
  year text,
  roll_no text not null,
  checked_in boolean not null default false,
  registered_at timestamptz not null default now()
);

create index if not exists registrations_event_id_idx on registrations(event_id);

-- Row Level Security
alter table events enable row level security;
alter table registrations enable row level security;

-- Anyone (including anonymous visitors) can read events
create policy "public read events" on events
  for select using (true);

-- Anyone can read registrations (needed for admin check-in/table view,
-- since this app has no server-side admin session)
create policy "public read registrations" on registrations
  for select using (true);

-- Anyone can insert a registration (students registering themselves)
create policy "public insert registrations" on registrations
  for insert with check (true);

-- Anyone can update a registration (used for check-in)
create policy "public update registrations" on registrations
  for update using (true);

-- Admin actions (add/edit/delete events) also go through the anon key,
-- since the "admin login" in this app is a client-side-only check, not a
-- real authenticated session. See the security note in the chat reply.
create policy "public write events" on events
  for insert with check (true);
create policy "public update events" on events
  for update using (true);
create policy "public delete events" on events
  for delete using (true);
