-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Prayer logs table
create table if not exists prayer_logs (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users not null,
  logged_at     timestamptz not null,
  prayer_date   date not null,
  hours         int not null default 0,
  minutes       int not null default 0,
  seconds       int not null default 0,
  total_seconds int not null,
  memory_note   text,
  created_at    timestamptz default now()
);

-- Row Level Security
alter table prayer_logs enable row level security;

create policy "Users see own logs"
  on prayer_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Settings table
create table if not exists user_settings (
  user_id         uuid references auth.users primary key,
  whatsapp_group  text,
  updated_at      timestamptz default now()
);

alter table user_settings enable row level security;

create policy "Users see own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_prayer_logs_user_date
  on prayer_logs (user_id, prayer_date desc);
