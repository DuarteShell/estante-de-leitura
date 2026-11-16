-- =============================================================
-- Estante de Leitura — schema do Supabase
-- Cole tudo no Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem quebrar (usa "if not exists").
-- Modelo: qualquer pessoa LÊ (portfólio público); só a dona/dono
-- dos dados (usuário logado) cria, edita e apaga.
-- =============================================================

-- ---------- Perfil ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Leitor',
  site_title   text,
  bio          text,
  annual_goal  int check (annual_goal is null or annual_goal > 0),
  updated_at   timestamptz not null default now()
);

-- ---------- Livros (a estante / catálogo) ----------
create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  author       text,
  isbn         text,
  cover_url    text,
  genres       text[] not null default '{}',
  pages        int check (pages is null or pages > 0),
  status       text not null default 'nao_lido'
               check (status in ('nao_lido', 'lendo', 'lido', 'abandonado', 'desejo')),
  owned        boolean not null default true,   -- está na estante física/digital
  current_page int check (current_page is null or current_page >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists books_user_idx on public.books (user_id);

-- ---------- Leituras (cada vez que um livro foi lido) ----------
-- Um livro "lido" sem nenhuma leitura registrada = leitura legado.
create table if not exists public.readings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  book_id     uuid not null references public.books on delete cascade,
  status      text not null default 'lido' check (status in ('lendo', 'lido', 'abandonado')),
  started_at  date,
  finished_at date,
  year        int,              -- ano da leitura quando não há datas exatas
  rating      numeric(2, 1)
              check (rating is null or (rating between 0 and 5 and rating * 2 = floor(rating * 2))),
  format      text check (format is null or format in ('fisico', 'kindle', 'audiobook', 'outro')),
  pages_read  int,
  review      text,
  created_at  timestamptz not null default now()
);
create index if not exists readings_book_idx on public.readings (book_id);
create index if not exists readings_user_idx on public.readings (user_id);

-- ---------- Citações ----------
create table if not exists public.quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  book_id    uuid not null references public.books on delete cascade,
  text       text not null,
  page       int,
  created_at timestamptz not null default now()
);
create index if not exists quotes_book_idx on public.quotes (book_id);

-- ---------- updated_at automático ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books
  for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Perfil criado junto com o usuário ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Leitor'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existiam antes deste script
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.readings enable row level security;
alter table public.quotes   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books', 'readings', 'quotes'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "dono escreve" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format('create policy "dono escreve" on public.%I for all to authenticated
                    using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "leitura publica" on public.profiles;
drop policy if exists "dono escreve" on public.profiles;
create policy "leitura publica" on public.profiles for select using (true);
create policy "dono escreve" on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- Storage: fotos de capa ----------
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "capas: dono envia" on storage.objects;
drop policy if exists "capas: dono altera" on storage.objects;
drop policy if exists "capas: dono apaga" on storage.objects;
create policy "capas: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "capas: dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "capas: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
