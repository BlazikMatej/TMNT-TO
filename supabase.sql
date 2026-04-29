create extension if not exists "pgcrypto";

create table if not exists public.tmnt_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  meta_currency integer not null default 0,
  unlocked_units jsonb not null default '["leo","mike","don","raph"]'::jsonb,
  unit_upgrades jsonb not null default '{"leo":1,"mike":1,"don":1,"raph":1,"splinter":1,"april":1,"casey":1}'::jsonb,
  max_level integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.tmnt_users
  add column if not exists unit_upgrades jsonb not null default '{"leo":1,"mike":1,"don":1,"raph":1,"splinter":1,"april":1,"casey":1}'::jsonb;
