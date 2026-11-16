-- =============================================================
-- Estante de Leitura — schema do Supabase (multiusuário)
-- Cole tudo no Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem quebrar (é idempotente).
--
-- Modelo: cada pessoa tem a própria estante (login com @usuário + PIN).
-- Estante pública: qualquer um vê. Estante privada: só a dona/dono.
-- Escrever/editar: sempre só a dona/dono.
-- =============================================================

-- ---------- Perfil ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Leitor',
  updated_at   timestamptz not null default now()
);
alter table public.profiles add column if not exists username    text;
alter table public.profiles add column if not exists site_title  text;
alter table public.profiles add column if not exists bio         text;
alter table public.profiles add column if not exists annual_goal int;
alter table public.profiles add column if not exists is_public   boolean not null default true;
alter table public.profiles add column if not exists created_at  timestamptz not null default now();

do $$ begin
  alter table public.profiles add constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_goal_positive
    check (annual_goal is null or annual_goal > 0);
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_username_key on public.profiles (username);

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
-- sagas e ordem manual na estante
alter table public.books add column if not exists series         text;
alter table public.books add column if not exists series_index   numeric(5, 1);
alter table public.books add column if not exists series_total   int;
alter table public.books add column if not exists shelf_position int;
do $$ begin
  alter table public.books add constraint books_series_numbers
    check ((series_index is null or series_index >= 0) and (series_total is null or series_total > 0));
exception when duplicate_object then null; end $$;

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

-- O @ é a chave do login: não pode ser trocado depois de criado.
create or replace function public.lock_username() returns trigger
language plpgsql as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'O @usuário não pode ser alterado';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_username on public.profiles;
create trigger profiles_lock_username before update on public.profiles
  for each row execute function public.lock_username();

-- ---------- Perfil criado junto com o usuário ----------
-- O app cadastra com e-mail técnico "<usuario>@estante-de-leitura.app" e manda
-- username/display_name nos metadados.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
begin
  uname := regexp_replace(uname, '[^a-z0-9_]', '', 'g');
  if length(uname) < 3 then uname := uname || substr(replace(new.id::text, '-', ''), 1, 6); end if;
  uname := substr(uname, 1, 20);
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), uname))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários/perfis que já existiam antes deste script
insert into public.profiles (id, username, display_name)
select u.id,
       substr(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g') || '_' || substr(u.id::text, 1, 4), 1, 20),
       split_part(u.email, '@', 1)
from auth.users u
on conflict (id) do nothing;
update public.profiles p
set username = substr(regexp_replace(lower(coalesce(p.display_name, 'leitor')), '[^a-z0-9_]', '', 'g') || '_' || substr(p.id::text, 1, 4), 1, 20)
where p.username is null;
alter table public.profiles alter column username set not null;

-- Disponibilidade do @ no cadastro (sem expor perfis privados)
create or replace function public.username_available(u text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where username = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Ordem manual da estante: grava a posição de vários livros numa chamada só.
-- Roda com as permissões de quem chama (RLS vale): só mexe nos próprios livros.
create or replace function public.reorder_books(ids uuid[]) returns void
language sql security invoker set search_path = public as $$
  update public.books b
  set shelf_position = o.pos
  from unnest(ids) with ordinality as o(id, pos)
  where b.id = o.id and b.user_id = auth.uid();
$$;
grant execute on function public.reorder_books(uuid[]) to authenticated;

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.readings enable row level security;
alter table public.quotes   enable row level security;

-- dono é público?
create or replace function public.is_public_owner(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_public from public.profiles where id = uid), false);
$$;

do $$
declare t text;
begin
  foreach t in array array['books', 'readings', 'quotes'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "dono escreve" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select
                    using (auth.uid() = user_id or public.is_public_owner(user_id))', t);
    execute format('create policy "dono escreve" on public.%I for all to authenticated
                    using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "leitura publica" on public.profiles;
drop policy if exists "dono escreve" on public.profiles;
create policy "leitura publica" on public.profiles for select
  using (is_public or auth.uid() = id);
create policy "dono escreve" on public.profiles for update to authenticated
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

-- =============================================================
-- Esqueceram o PIN? Rode (troque o @ e o PIN novo):
--   update auth.users
--   set encrypted_password = crypt('123456', gen_salt('bf'))
--   where email = 'fulana@estante-de-leitura.app';
-- =============================================================
