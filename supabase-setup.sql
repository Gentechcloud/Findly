-- ============================================================
-- Findly — Этап 2: таблица профилей + вход по логину или почте
-- Вставьте этот файл целиком в Supabase → SQL Editor → Run
-- ============================================================

-- 1. Таблица профилей пользователей.
--    Отдельно от встроенной таблицы auth.users (там email/пароль),
--    здесь храним публичные данные: ник, имя, фамилию, аватар, "о себе".
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  first_name text,
  last_name text,
  bio text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Включаем защиту на уровне строк (Row Level Security) —
--    без неё любой человек с ключом мог бы читать/менять чужие данные.
alter table public.profiles enable row level security;

drop policy if exists "Профили видны всем" on public.profiles;
create policy "Профили видны всем"
  on public.profiles for select
  using (true);

drop policy if exists "Можно менять только свой профиль" on public.profiles;
create policy "Можно менять только свой профиль"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Профиль создаётся автоматически" on public.profiles;
create policy "Профиль создаётся автоматически"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3. Функция + триггер: при регистрации нового пользователя
--    (запись в auth.users) автоматически создаём для него строку в profiles,
--    забирая username из данных, переданных при регистрации.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Вход по логину (нику), а не только по почте.
--    Supabase Auth умеет входить только по email, поэтому эта функция
--    по нику находит привязанную почту — только если ник существует,
--    саму почту наружу не показываем нигде, кроме как для входа.
create or replace function public.email_for_username(lookup_username text)
returns text
language sql
security definer set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = lookup_username
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============================================================
-- Этап 3: хранилище аватарок
-- ============================================================

-- Бакет (папка) для аватарок, публично читаемый (чтобы фото открывались
-- в чате у всех), но загружать в него может только сам пользователь.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Аватарки видны всем" on storage.objects;
create policy "Аватарки видны всем"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Можно загружать только в свою папку" on storage.objects;
create policy "Можно загружать только в свою папку"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Можно обновлять только свои файлы" on storage.objects;
create policy "Можно обновлять только свои файлы"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Этап 4: чаты, сообщения, Findline
-- ============================================================

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct','group','channel')),
  title text,
  avatar_url text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_participants (
  chat_id uuid references public.chats (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats (id) on delete cascade,
  sender_id uuid references auth.users (id),
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_for_everyone boolean not null default false
);

alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;

-- chats: видны только участникам
drop policy if exists "Участники видят свои чаты" on public.chats;
create policy "Участники видят свои чаты" on public.chats for select
  using (exists (select 1 from public.chat_participants cp where cp.chat_id = chats.id and cp.user_id = auth.uid()));

drop policy if exists "Любой залогиненный может создать чат" on public.chats;
create policy "Любой залогиненный может создать чат" on public.chats for insert
  with check (auth.uid() = created_by);

-- chat_participants: видны только участникам того же чата
drop policy if exists "Видны участники своих чатов" on public.chat_participants;
create policy "Видны участники своих чатов" on public.chat_participants for select
  using (exists (select 1 from public.chat_participants cp2 where cp2.chat_id = chat_participants.chat_id and cp2.user_id = auth.uid()));

drop policy if exists "Можно добавлять себя или создателю — участников" on public.chat_participants;
create policy "Можно добавлять себя или создателю — участников" on public.chat_participants for insert
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );

-- messages: видны только участникам чата
drop policy if exists "Сообщения видны участникам чата" on public.messages;
create policy "Сообщения видны участникам чата" on public.messages for select
  using (exists (select 1 from public.chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid()));

drop policy if exists "Отправлять может только участник" on public.messages;
create policy "Отправлять может только участник" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
  );

drop policy if exists "Редактировать/удалять может только автор" on public.messages;
create policy "Редактировать/удалять может только автор" on public.messages for update
  using (sender_id = auth.uid());

-- Функция: найти существующий личный чат с пользователем по нику,
-- или создать новый, если его ещё нет. Возвращает id чата.
create or replace function public.start_direct_chat(other_username text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing uuid;
  new_chat uuid;
begin
  select id into other from public.profiles where username = other_username;
  if other is null then
    raise exception 'Пользователь не найден';
  end if;
  if other = me then
    raise exception 'Нельзя создать чат с самим собой';
  end if;

  select cp1.chat_id into existing
  from public.chat_participants cp1
  join public.chat_participants cp2 on cp1.chat_id = cp2.chat_id
  join public.chats c on c.id = cp1.chat_id
  where cp1.user_id = me and cp2.user_id = other and c.type = 'direct'
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.chats (type, created_by) values ('direct', me) returning id into new_chat;
  insert into public.chat_participants (chat_id, user_id) values (new_chat, me), (new_chat, other);
  return new_chat;
end;
$$;

grant execute on function public.start_direct_chat(text) to authenticated;

-- Включаем realtime (мгновенную доставку) для сообщений.
-- Обёрнуто проверкой, чтобы скрипт можно было безопасно запускать повторно.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============================================================
-- Этап 5: голосовые/фото/видео/файлы, ответы, редактирование, удаление
-- ============================================================

alter table public.messages add column if not exists message_type text not null default 'text'
  check (message_type in ('text','voice','image','video','file'));
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages add column if not exists attachment_size bigint;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists waveform_levels jsonb;
alter table public.messages add column if not exists reply_to_id uuid references public.messages (id);

-- "Удалить только у себя" — не трогает саму запись, просто прячет её
-- для конкретного пользователя.
create table if not exists public.message_hidden (
  message_id uuid references public.messages (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_hidden enable row level security;

drop policy if exists "Каждый видит только свои скрытые сообщения" on public.message_hidden;
create policy "Каждый видит только свои скрытые сообщения" on public.message_hidden for select
  using (user_id = auth.uid());

drop policy if exists "Каждый может скрыть сообщение только себе" on public.message_hidden;
create policy "Каждый может скрыть сообщение только себе" on public.message_hidden for insert
  with check (user_id = auth.uid());

-- Хранилище для голосовых/фото/видео/файлов (до ~50 МБ на бесплатном тарифе —
-- можно увеличить в Project Settings → Storage, когда купите платный план).
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "Вложения видны всем" on storage.objects;
create policy "Вложения видны всем" on storage.objects for select
  using (bucket_id = 'attachments');

drop policy if exists "Загружать вложения может только сам пользователь" on storage.objects;
create policy "Загружать вложения может только сам пользователь" on storage.objects for insert
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime должен видеть и изменения (редактирование/удаление), не только новые сообщения.
alter table public.messages replica identity full;

-- ============================================================
-- Этап 7: система друзей + Mail (центр уведомлений)
-- ============================================================

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  seen_by_recipient boolean not null default false,
  seen_by_sender boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_user, to_user)
);

alter table public.friend_requests enable row level security;

drop policy if exists "Видны только свои заявки" on public.friend_requests;
create policy "Видны только свои заявки" on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "Можно отправлять заявки от своего имени" on public.friend_requests;
create policy "Можно отправлять заявки от своего имени" on public.friend_requests for insert
  with check (auth.uid() = from_user);

drop policy if exists "Можно менять только свои заявки" on public.friend_requests;
create policy "Можно менять только свои заявки" on public.friend_requests for update
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Отправить заявку в друзья по нику
create or replace function public.send_friend_request(target_username text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  reverse_status text;
begin
  select id into target from public.profiles where username = target_username;
  if target is null then raise exception 'Пользователь не найден'; end if;
  if target = me then raise exception 'Нельзя добавить себя в друзья'; end if;

  select status into reverse_status from public.friend_requests where from_user = target and to_user = me;
  if reverse_status = 'pending' then
    update public.friend_requests set status = 'accepted', responded_at = now(), seen_by_sender = false
      where from_user = target and to_user = me;
    return;
  end if;
  if reverse_status = 'accepted' then
    raise exception 'Вы уже друзья';
  end if;

  insert into public.friend_requests (from_user, to_user) values (me, target)
  on conflict (from_user, to_user) do update set status = 'pending', created_at = now(), responded_at = null, seen_by_recipient = false
    where public.friend_requests.status = 'declined';
end;
$$;
grant execute on function public.send_friend_request(text) to authenticated;

-- Принять/отклонить заявку
create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.friend_requests
  set status = case when accept then 'accepted' else 'declined' end,
      responded_at = now(), seen_by_sender = false
  where id = request_id and to_user = auth.uid();
end;
$$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Статус отношений с пользователем: 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends'
create or replace function public.relationship_status(other_username text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  other uuid;
  r record;
begin
  select id into other from public.profiles where username = other_username;
  if other is null then return 'not_found'; end if;
  if other = me then return 'self'; end if;

  select * into r from public.friend_requests
    where (from_user = me and to_user = other) or (from_user = other and to_user = me)
    limit 1;

  if r is null then return 'none'; end if;
  if r.status = 'accepted' then return 'friends'; end if;
  if r.status = 'declined' then return 'none'; end if;
  if r.from_user = me then return 'pending_outgoing'; end if;
  return 'pending_incoming';
end;
$$;
grant execute on function public.relationship_status(text) to authenticated;

-- Теперь чат можно начать только с другом
create or replace function public.start_direct_chat(other_username text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing uuid;
  new_chat uuid;
  are_friends boolean;
begin
  select id into other from public.profiles where username = other_username;
  if other is null then raise exception 'Пользователь не найден'; end if;
  if other = me then raise exception 'Нельзя создать чат с самим собой'; end if;

  select exists(
    select 1 from public.friend_requests
    where status = 'accepted' and ((from_user = me and to_user = other) or (from_user = other and to_user = me))
  ) into are_friends;
  if not are_friends then
    raise exception 'Сначала добавьте пользователя в друзья';
  end if;

  select cp1.chat_id into existing
  from public.chat_participants cp1
  join public.chat_participants cp2 on cp1.chat_id = cp2.chat_id
  join public.chats c on c.id = cp1.chat_id
  where cp1.user_id = me and cp2.user_id = other and c.type = 'direct'
  limit 1;

  if existing is not null then return existing; end if;

  insert into public.chats (type, created_by) values ('direct', me) returning id into new_chat;
  insert into public.chat_participants (chat_id, user_id) values (new_chat, me), (new_chat, other);
  return new_chat;
end;
$$;
