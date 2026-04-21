create extension if not exists "pgcrypto";

create table if not exists public.tmnt_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  meta_currency integer not null default 0,
  unlocked_units jsonb not null default '["leo","mike","don","raph"]'::jsonb,
  max_level integer not null default 1,
  created_at timestamptz not null default now()
);
