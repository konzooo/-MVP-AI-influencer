-- ─── Enable UUID extension ───────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Posts table ─────────────────────────────────────────────────────────────
create table if not exists posts (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  data          jsonb not null,
  status        text not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast user+status queries
create index if not exists posts_user_id_idx on posts(user_id);
create index if not exists posts_status_idx on posts(status);
create index if not exists posts_updated_at_idx on posts(updated_at desc);

-- ─── Tasks table ─────────────────────────────────────────────────────────────
create table if not exists tasks (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  data          jsonb not null,
  status        text not null default 'paused',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on tasks(user_id);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table posts enable row level security;
alter table tasks enable row level security;

-- Users can only see and modify their own posts
create policy "posts: owner access" on posts
  for all using (auth.uid() = user_id);

-- Users can only see and modify their own tasks
create policy "tasks: owner access" on tasks
  for all using (auth.uid() = user_id);

-- ─── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('generated-images', 'generated-images', true)
  on conflict do nothing;

insert into storage.buckets (id, name, public)
  values ('reference-images', 'reference-images', true)
  on conflict do nothing;

-- Storage policies: owner access only for uploads, public read
create policy "generated-images: public read" on storage.objects
  for select using (bucket_id = 'generated-images');

create policy "generated-images: owner upload" on storage.objects
  for insert with check (bucket_id = 'generated-images' and auth.uid() is not null);

create policy "generated-images: owner delete" on storage.objects
  for delete using (bucket_id = 'generated-images' and auth.uid() is not null);

create policy "reference-images: public read" on storage.objects
  for select using (bucket_id = 'reference-images');

create policy "reference-images: owner upload" on storage.objects
  for insert with check (bucket_id = 'reference-images' and auth.uid() is not null);

create policy "reference-images: owner delete" on storage.objects
  for delete using (bucket_id = 'reference-images' and auth.uid() is not null);
