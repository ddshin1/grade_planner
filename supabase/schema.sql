-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Creates the table for class setups students share. Scores are never stored.

create table if not exists shared_classes (
  id uuid primary key default gen_random_uuid(),
  college_key text not null,
  -- The whole setup in a fixed form; sharing the same setup twice keeps one row.
  signature text not null unique,
  data jsonb not null,
  reports integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shared_classes_college on shared_classes (college_key, created_at desc);

-- Only the website's server (with the secret key) can read or write.
-- No policies are added, so the public key gets no access at all.
alter table shared_classes enable row level security;

-- Adds one report to a setup. Setups with enough reports stop showing in search.
create or replace function report_shared_class(class_id uuid) returns void
language sql as $$
  update shared_classes set reports = reports + 1 where id = class_id;
$$;
revoke execute on function report_shared_class(uuid) from public, anon, authenticated;
