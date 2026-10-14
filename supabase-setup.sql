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

-- ============================================================
-- Этап 6а: группы (создание, участники, роли — база)
-- ============================================================

alter table public.chats add column if not exists slow_mode_seconds integer not null default 0;
alter table public.chat_participants add column if not exists role text not null default 'member'
  check (role in ('owner','admin','moderator','member'));
alter table public.chat_participants add column if not exists muted_until timestamptz;

-- Создать группу: я становлюсь владельцем, добавляю участников только из друзей
create or replace function public.create_group(group_title text, group_avatar_url text, member_usernames text[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_chat uuid;
  uname text;
  target uuid;
  is_friend boolean;
begin
  if group_title is null or length(trim(group_title)) = 0 then
    raise exception 'Укажите название группы';
  end if;

  insert into public.chats (type, title, avatar_url, created_by) values ('group', group_title, group_avatar_url, me)
    returning id into new_chat;
  insert into public.chat_participants (chat_id, user_id, role) values (new_chat, me, 'owner');

  if member_usernames is not null then
    foreach uname in array member_usernames loop
      select id into target from public.profiles where username = uname;
      if target is not null and target <> me then
        select exists(
          select 1 from public.friend_requests
          where status = 'accepted' and ((from_user = me and to_user = target) or (from_user = target and to_user = me))
        ) into is_friend;
        if is_friend then
          insert into public.chat_participants (chat_id, user_id, role) values (new_chat, target, 'member')
            on conflict (chat_id, user_id) do nothing;
        end if;
      end if;
    end loop;
  end if;

  return new_chat;
end;
$$;
grant execute on function public.create_group(text, text, text[]) to authenticated;

-- ============================================================
-- ФИКС: связи должны указывать на profiles, а не на auth.users,
-- иначе Supabase не может автоматически "подтягивать" профиль
-- одним запросом (из-за этого Mail/список друзей были пустыми).
-- ============================================================

alter table public.chat_participants drop constraint if exists chat_participants_user_id_fkey;
alter table public.chat_participants add constraint chat_participants_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles (id);

alter table public.chats drop constraint if exists chats_created_by_fkey;
alter table public.chats add constraint chats_created_by_fkey
  foreign key (created_by) references public.profiles (id);

alter table public.friend_requests drop constraint if exists friend_requests_from_user_fkey;
alter table public.friend_requests add constraint friend_requests_from_user_fkey
  foreign key (from_user) references public.profiles (id) on delete cascade;

alter table public.friend_requests drop constraint if exists friend_requests_to_user_fkey;
alter table public.friend_requests add constraint friend_requests_to_user_fkey
  foreign key (to_user) references public.profiles (id) on delete cascade;

alter table public.message_hidden drop constraint if exists message_hidden_user_id_fkey;
alter table public.message_hidden add constraint message_hidden_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- Просим Supabase немедленно обновить "карту связей" (обычно происходит
-- само за несколько секунд, эта команда просто ускоряет процесс).
notify pgrst, 'reload schema';

-- ============================================================
-- Этап 8: настройки — безопасность чата, приватность, блокировки
-- ============================================================

alter table public.profiles add column if not exists restrict_voice boolean not null default false;
alter table public.profiles add column if not exists restrict_media boolean not null default false;
alter table public.profiles add column if not exists avatar_visibility text not null default 'all'
  check (avatar_visibility in ('all','friends','none'));
alter table public.profiles add column if not exists profile_visibility text not null default 'all'
  check (profile_visibility in ('all','friends'));

create table if not exists public.blocked_users (
  blocker_id uuid references public.profiles (id) on delete cascade,
  blocked_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocked_users enable row level security;

drop policy if exists "Вижу блокировки, где я участник" on public.blocked_users;
create policy "Вижу блокировки, где я участник" on public.blocked_users for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "Блокировать могу только от своего имени" on public.blocked_users;
create policy "Блокировать могу только от своего имени" on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Разблокировать могу только свои блокировки" on public.blocked_users;
create policy "Разблокировать могу только свои блокировки" on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Блокировка теперь тоже мешает начать (новый) чат
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
  is_blocked boolean;
begin
  select id into other from public.profiles where username = other_username;
  if other is null then raise exception 'Пользователь не найден'; end if;
  if other = me then raise exception 'Нельзя создать чат с самим собой'; end if;

  select exists(
    select 1 from public.blocked_users
    where (blocker_id = me and blocked_id = other) or (blocker_id = other and blocked_id = me)
  ) into is_blocked;
  if is_blocked then raise exception 'Переписка недоступна — пользователь заблокирован'; end if;

  select exists(
    select 1 from public.friend_requests
    where status = 'accepted' and ((from_user = me and to_user = other) or (from_user = other and to_user = me))
  ) into are_friends;
  if not are_friends then raise exception 'Сначала добавьте пользователя в друзья'; end if;

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

-- Смена ника: та же проверка формата, что при регистрации
create or replace function public.change_username(new_username text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if new_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Ник: 3–20 символов, латиница/цифры/_';
  end if;
  update public.profiles set username = new_username where id = auth.uid();
exception when unique_violation then
  raise exception 'Этот ник уже занят';
end;
$$;
grant execute on function public.change_username(text) to authenticated;

-- ============================================================
-- Этап 7б: общая таблица уведомлений + удаление из друзей
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null,
  body text not null,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "Вижу только свои уведомления" on public.notifications;
create policy "Вижу только свои уведомления" on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Отмечать своё прочитанным может только владелец" on public.notifications;
create policy "Отмечать своё прочитанным может только владелец" on public.notifications for update
  using (auth.uid() = user_id);

-- Прямая вставка из клиента запрещена — уведомления создают только
-- доверенные функции (security definer), например remove_friend ниже.
drop policy if exists "Прямая вставка запрещена" on public.notifications;
create policy "Прямая вставка запрещена" on public.notifications for insert
  with check (false);

create or replace function public.remove_friend(target_username text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  my_name text;
  target_name text;
begin
  select id, (first_name || ' ' || last_name) into target, target_name from public.profiles where username = target_username;
  if target is null then raise exception 'Пользователь не найден'; end if;

  select (first_name || ' ' || last_name) into my_name from public.profiles where id = me;

  delete from public.friend_requests
  where status = 'accepted' and ((from_user = me and to_user = target) or (from_user = target and to_user = me));

  insert into public.notifications (user_id, kind, body) values
    (me, 'friend_removed', my_name || ' и ' || target_name || ' больше не друзья.'),
    (target, 'friend_removed', coalesce(my_name, 'Пользователь') || ' удалил(а) вас из друзей.');
end;
$$;
grant execute on function public.remove_friend(text) to authenticated;

-- ============================================================
-- ИСПРАВЛЕНИЕ БЕЗОПАСНОСТИ/РЕКУРСИИ + ЭТАП 6б/6в
-- (модерация групп, каналы, приглашения, журнал действий)
-- Скрипт безопасно запускать повторно.
-- ============================================================

-- ---------- 1. Вспомогательные функции (без рекурсии в политиках) ----------
create or replace function public.role_rank(p_role text)
returns integer language sql immutable as $$
  select case p_role when 'owner' then 4 when 'admin' then 3 when 'moderator' then 2 when 'member' then 1 else 0 end
$$;

create or replace function public.chat_role(p_chat uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.chat_participants where chat_id = p_chat and user_id = p_user
$$;

create or replace function public.is_chat_member(p_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_participants where chat_id = p_chat and user_id = auth.uid())
$$;

create or replace function public.is_chat_staff(p_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_participants
                 where chat_id = p_chat and user_id = auth.uid() and role in ('owner','admin','moderator'))
$$;

grant execute on function public.role_rank(text) to authenticated;
grant execute on function public.chat_role(uuid, uuid) to authenticated;
grant execute on function public.is_chat_member(uuid) to authenticated;
grant execute on function public.is_chat_staff(uuid) to authenticated;

-- ---------- 2. Пересоздаём политики chats / chat_participants / messages ----------
-- Старые политики ссылались на chat_participants внутри самой chat_participants —
-- Postgres выдаёт "infinite recursion" на любой запрос. Удаляем ВСЕ политики
-- этих таблиц (включая созданные вручную через панель) и создаём правильные.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('chats', 'chat_participants', 'messages')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Создавать чаты и менять состав можно только через функции (security definer) ниже,
-- поэтому INSERT-политик на chats/chat_participants нет вообще.
create policy chats_select on public.chats for select using (public.is_chat_member(id));
create policy participants_select on public.chat_participants for select using (public.is_chat_member(chat_id));
create policy messages_select on public.messages for select using (public.is_chat_member(chat_id));
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));
create policy messages_update_own on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

-- ---------- 3. Новые поля и таблицы ----------
alter table public.chats add column if not exists description text;
alter table public.chats add column if not exists comments_enabled boolean not null default true;

create table if not exists public.chat_bans (
  chat_id uuid references public.chats (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.chat_audit_log (
  id bigint generated always as identity primary key,
  chat_id uuid references public.chats (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  target_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_invites (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats (id) on delete cascade,
  from_user uuid references public.profiles (id) on delete cascade,
  to_user uuid references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (chat_id, to_user)
);

create table if not exists public.post_reactions (
  message_id uuid references public.messages (id) on delete cascade,
  chat_id uuid references public.chats (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  primary key (message_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.messages (id) on delete cascade,
  chat_id uuid references public.chats (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

alter table public.chat_bans enable row level security;
alter table public.chat_audit_log enable row level security;
alter table public.chat_invites enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists bans_select on public.chat_bans;
create policy bans_select on public.chat_bans for select using (public.is_chat_staff(chat_id));
drop policy if exists audit_select on public.chat_audit_log;
create policy audit_select on public.chat_audit_log for select using (public.is_chat_staff(chat_id));
drop policy if exists invites_select on public.chat_invites;
create policy invites_select on public.chat_invites for select using (auth.uid() = to_user or auth.uid() = from_user);
drop policy if exists reactions_select on public.post_reactions;
create policy reactions_select on public.post_reactions for select using (public.is_chat_member(chat_id));
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select using (public.is_chat_member(chat_id));

alter table public.post_reactions replica identity full;
alter table public.post_comments replica identity full;

do $$
declare t text;
begin
  foreach t in array array['post_reactions', 'post_comments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- 4. Журнал действий ----------
create or replace function public.log_chat_action(p_chat uuid, p_actor uuid, p_target uuid, p_action text, p_details text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.chat_audit_log (chat_id, actor_id, target_id, action, details)
  values (p_chat, p_actor, p_target, p_action, p_details)
$$;
revoke execute on function public.log_chat_action(uuid, uuid, uuid, text, text) from public, anon, authenticated;

-- ---------- 5. Правила сообщений (мут, медленный режим, каналы, блокировки) ----------
create or replace function public.enforce_message_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  p record;
  other uuid;
  other_prof record;
  last_at timestamptz;
  wait_sec integer;
begin
  select type, slow_mode_seconds into c from public.chats where id = new.chat_id;
  select role, muted_until into p from public.chat_participants where chat_id = new.chat_id and user_id = new.sender_id;
  if p is null then raise exception 'Вы не участник этого чата'; end if;

  if c.type = 'direct' then
    select user_id into other from public.chat_participants where chat_id = new.chat_id and user_id <> new.sender_id limit 1;
    if other is not null then
      if exists (select 1 from public.blocked_users b
                 where (b.blocker_id = new.sender_id and b.blocked_id = other)
                    or (b.blocker_id = other and b.blocked_id = new.sender_id)) then
        raise exception 'Переписка недоступна — пользователь заблокирован';
      end if;
      select restrict_voice, restrict_media into other_prof from public.profiles where id = other;
      if new.message_type = 'voice' and other_prof.restrict_voice then
        raise exception 'Собеседник запретил присылать голосовые сообщения';
      end if;
      if new.message_type in ('image', 'video', 'file') and other_prof.restrict_media then
        raise exception 'Собеседник запретил присылать фото, видео и файлы';
      end if;
    end if;
    return new;
  end if;

  if p.muted_until is not null and p.muted_until > now() then
    raise exception 'Вы заглушены — осталось % мин.', ceil(extract(epoch from (p.muted_until - now())) / 60.0)::int;
  end if;

  if c.type = 'channel' and p.role not in ('owner', 'admin') then
    raise exception 'В канале публиковать могут только администраторы';
  end if;

  if c.type = 'group' and c.slow_mode_seconds > 0 and p.role = 'member' then
    select max(created_at) into last_at from public.messages where chat_id = new.chat_id and sender_id = new.sender_id;
    if last_at is not null and last_at + make_interval(secs => c.slow_mode_seconds) > now() then
      wait_sec := ceil(extract(epoch from (last_at + make_interval(secs => c.slow_mode_seconds) - now())))::int;
      raise exception 'Медленный режим: подождите ещё % сек.', wait_sec;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_message_rules on public.messages;
create trigger trg_enforce_message_rules before insert on public.messages
  for each row execute function public.enforce_message_rules();

create or replace function public.guard_message_update()
returns trigger language plpgsql as $$
begin
  new.chat_id := old.chat_id;
  new.sender_id := old.sender_id;
  new.message_type := old.message_type;
  if old.deleted_for_everyone then new.deleted_for_everyone := true; end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------- 6. Создание группы / канала ----------
create or replace function public.create_chat(p_kind text, p_title text, p_avatar_url text, p_description text, p_members text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_chat uuid;
  uname text;
  target uuid;
  is_friend boolean;
begin
  if p_kind not in ('group', 'channel') then raise exception 'Неизвестный тип чата'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'Укажите название'; end if;

  insert into public.chats (type, title, avatar_url, description, created_by)
  values (p_kind, trim(p_title), p_avatar_url, nullif(trim(coalesce(p_description, '')), ''), me)
  returning id into new_chat;
  insert into public.chat_participants (chat_id, user_id, role) values (new_chat, me, 'owner');
  perform public.log_chat_action(new_chat, me, null, 'create', trim(p_title));

  if p_members is not null then
    foreach uname in array p_members loop
      select id into target from public.profiles where username = uname;
      if target is not null and target <> me then
        select exists (select 1 from public.friend_requests
                       where status = 'accepted' and ((from_user = me and to_user = target) or (from_user = target and to_user = me)))
          into is_friend;
        if is_friend then
          insert into public.chat_participants (chat_id, user_id, role) values (new_chat, target, 'member')
            on conflict (chat_id, user_id) do nothing;
          perform public.log_chat_action(new_chat, me, target, 'add', null);
        end if;
      end if;
    end loop;
  end if;
  return new_chat;
end;
$$;

create or replace function public.create_group(group_title text, group_avatar_url text, member_usernames text[])
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.create_chat('group', group_title, group_avatar_url, null, member_usernames);
end;
$$;

-- ---------- 7. Участники ----------
create or replace function public.get_chat_members(p_chat uuid)
returns table (user_id uuid, username text, first_name text, last_name text, avatar_url text,
               role text, muted_until timestamptz, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_chat_member(p_chat) then raise exception 'Нет доступа'; end if;
  return query
    select cp.user_id, p.username, p.first_name, p.last_name, p.avatar_url, cp.role, cp.muted_until, cp.joined_at
    from public.chat_participants cp
    join public.profiles p on p.id = cp.user_id
    where cp.chat_id = p_chat
    order by public.role_rank(cp.role) desc, cp.joined_at asc;
end;
$$;

create or replace function public.set_member_role(p_chat uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_role text; target_role text; c_type text;
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  my_role := public.chat_role(p_chat, me);
  target_role := public.chat_role(p_chat, p_user);
  if my_role is null or target_role is null then raise exception 'Участник не найден'; end if;
  if p_role not in ('admin', 'moderator', 'member') then raise exception 'Недопустимая роль'; end if;
  if p_user = me then raise exception 'Нельзя менять свою роль'; end if;
  if target_role = 'owner' then raise exception 'Нельзя менять роль владельца'; end if;
  if public.role_rank(my_role) < 3 then raise exception 'Недостаточно прав'; end if;
  if my_role = 'admin' and (target_role = 'admin' or p_role = 'admin') then
    raise exception 'Назначать и снимать администраторов может только владелец';
  end if;
  update public.chat_participants set role = p_role where chat_id = p_chat and user_id = p_user;
  perform public.log_chat_action(p_chat, me, p_user, 'role', p_role);
end;
$$;

create or replace function public.mute_member(p_chat uuid, p_user uuid, p_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_role text; target_role text; c_type text;
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  my_role := public.chat_role(p_chat, me);
  target_role := public.chat_role(p_chat, p_user);
  if my_role is null or target_role is null then raise exception 'Участник не найден'; end if;
  if public.role_rank(my_role) < 2 then raise exception 'Недостаточно прав'; end if;
  if public.role_rank(my_role) <= public.role_rank(target_role) then
    raise exception 'Нельзя заглушить участника с равными или большими правами';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    update public.chat_participants set muted_until = null where chat_id = p_chat and user_id = p_user;
    perform public.log_chat_action(p_chat, me, p_user, 'unmute', null);
  else
    update public.chat_participants set muted_until = now() + make_interval(mins => p_minutes)
      where chat_id = p_chat and user_id = p_user;
    perform public.log_chat_action(p_chat, me, p_user, 'mute', p_minutes || ' мин.');
  end if;
end;
$$;

create or replace function public.kick_member(p_chat uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_role text; target_role text; c_type text;
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  my_role := public.chat_role(p_chat, me);
  target_role := public.chat_role(p_chat, p_user);
  if my_role is null or target_role is null then raise exception 'Участник не найден'; end if;
  if public.role_rank(my_role) < 2 then raise exception 'Недостаточно прав'; end if;
  if public.role_rank(my_role) <= public.role_rank(target_role) then
    raise exception 'Нельзя исключить участника с равными или большими правами';
  end if;
  delete from public.chat_participants where chat_id = p_chat and user_id = p_user;
  perform public.log_chat_action(p_chat, me, p_user, 'kick', null);
end;
$$;

create or replace function public.ban_member(p_chat uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_role text; target_role text; c_type text;
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  my_role := public.chat_role(p_chat, me);
  target_role := public.chat_role(p_chat, p_user);
  if my_role is null or target_role is null then raise exception 'Участник не найден'; end if;
  if public.role_rank(my_role) < 3 then raise exception 'Банить могут только администраторы'; end if;
  if public.role_rank(my_role) <= public.role_rank(target_role) then
    raise exception 'Нельзя забанить участника с равными или большими правами';
  end if;
  insert into public.chat_bans (chat_id, user_id, banned_by) values (p_chat, p_user, me)
    on conflict (chat_id, user_id) do nothing;
  delete from public.chat_participants where chat_id = p_chat and user_id = p_user;
  perform public.log_chat_action(p_chat, me, p_user, 'ban', null);
end;
$$;

create or replace function public.unban_member(p_chat uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if public.role_rank(public.chat_role(p_chat, me)) < 3 then raise exception 'Недостаточно прав'; end if;
  delete from public.chat_bans where chat_id = p_chat and user_id = p_user;
  perform public.log_chat_action(p_chat, me, p_user, 'unban', null);
end;
$$;

-- ---------- 8. Настройки чата ----------
create or replace function public.update_chat_settings(
  p_chat uuid, p_title text default null, p_description text default null,
  p_slow_mode integer default null, p_comments boolean default null, p_avatar_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c_type text; changes text := '';
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  if public.role_rank(public.chat_role(p_chat, me)) < 3 then raise exception 'Недостаточно прав'; end if;

  if p_title is not null then
    if length(trim(p_title)) = 0 then raise exception 'Название не может быть пустым'; end if;
    update public.chats set title = trim(p_title) where id = p_chat;
    changes := changes || 'название; ';
  end if;
  if p_description is not null then
    update public.chats set description = nullif(trim(p_description), '') where id = p_chat;
    changes := changes || 'описание; ';
  end if;
  if p_slow_mode is not null then
    if p_slow_mode < 0 or p_slow_mode > 86400 then raise exception 'Недопустимое значение медленного режима'; end if;
    update public.chats set slow_mode_seconds = p_slow_mode where id = p_chat;
    changes := changes || 'медленный режим ' || p_slow_mode || ' с; ';
  end if;
  if p_comments is not null then
    update public.chats set comments_enabled = p_comments where id = p_chat;
    changes := changes || 'комментарии ' || case when p_comments then 'вкл' else 'выкл' end || '; ';
  end if;
  if p_avatar_url is not null then
    update public.chats set avatar_url = p_avatar_url where id = p_chat;
    changes := changes || 'аватар; ';
  end if;
  perform public.log_chat_action(p_chat, me, null, 'settings', changes);
end;
$$;

-- ---------- 9. Приглашения ----------
create or replace function public.invite_to_chat(p_chat uuid, p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); my_role text; c record; target uuid; is_friend boolean;
begin
  select type, title into c from public.chats where id = p_chat;
  if c.type is null or c.type = 'direct' then raise exception 'Недоступно для этого чата'; end if;
  my_role := public.chat_role(p_chat, me);
  if my_role is null then raise exception 'Вы не участник'; end if;
  if c.type = 'channel' and public.role_rank(my_role) < 3 then
    raise exception 'Приглашать в канал могут только администраторы';
  end if;

  select id into target from public.profiles where username = p_username;
  if target is null then raise exception 'Пользователь не найден'; end if;
  if exists (select 1 from public.blocked_users
             where (blocker_id = me and blocked_id = target) or (blocker_id = target and blocked_id = me)) then
    raise exception 'Пользователь недоступен';
  end if;
  if exists (select 1 from public.chat_bans where chat_id = p_chat and user_id = target) then
    raise exception 'Пользователь заблокирован в этом чате';
  end if;
  if public.chat_role(p_chat, target) is not null then raise exception 'Уже участник'; end if;

  select exists (select 1 from public.friend_requests
                 where status = 'accepted' and ((from_user = me and to_user = target) or (from_user = target and to_user = me)))
    into is_friend;

  if is_friend then
    insert into public.chat_participants (chat_id, user_id, role) values (p_chat, target, 'member');
    perform public.log_chat_action(p_chat, me, target, 'add', null);
    insert into public.notifications (user_id, kind, body)
      values (target, 'chat_added', 'Вас добавили в «' || coalesce(c.title, 'чат') || '».');
    return 'added';
  end if;

  if exists (select 1 from public.chat_invites where chat_id = p_chat and to_user = target and status = 'pending') then
    raise exception 'Приглашение уже отправлено';
  end if;
  insert into public.chat_invites (chat_id, from_user, to_user) values (p_chat, me, target)
    on conflict (chat_id, to_user) do update set status = 'pending', from_user = excluded.from_user, created_at = now();
  perform public.log_chat_action(p_chat, me, target, 'invite', null);
  return 'invited';
end;
$$;

create or replace function public.respond_chat_invite(p_invite uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); inv record;
begin
  select * into inv from public.chat_invites where id = p_invite and to_user = me and status = 'pending';
  if inv is null then raise exception 'Приглашение не найдено'; end if;
  if p_accept then
    if exists (select 1 from public.chat_bans where chat_id = inv.chat_id and user_id = me) then
      raise exception 'Вы заблокированы в этом чате';
    end if;
    insert into public.chat_participants (chat_id, user_id, role) values (inv.chat_id, me, 'member')
      on conflict (chat_id, user_id) do nothing;
    update public.chat_invites set status = 'accepted' where id = p_invite;
    perform public.log_chat_action(inv.chat_id, me, me, 'join', null);
  else
    update public.chat_invites set status = 'declined' where id = p_invite;
  end if;
end;
$$;

-- ---------- 10. Выход, удаление, модераторское удаление сообщений ----------
create or replace function public.leave_chat(p_chat uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); my_role text; c_type text; succ uuid;
begin
  select type into c_type from public.chats where id = p_chat;
  if c_type is null or c_type = 'direct' then raise exception 'Из личного чата выйти нельзя'; end if;
  my_role := public.chat_role(p_chat, me);
  if my_role is null then raise exception 'Вы не участник'; end if;

  if my_role = 'owner' then
    select user_id into succ from public.chat_participants
      where chat_id = p_chat and user_id <> me
      order by public.role_rank(role) desc, joined_at asc limit 1;
    if succ is null then
      delete from public.chats where id = p_chat;
      return;
    end if;
    update public.chat_participants set role = 'owner' where chat_id = p_chat and user_id = succ;
    perform public.log_chat_action(p_chat, me, succ, 'owner_transfer', null);
  end if;
  delete from public.chat_participants where chat_id = p_chat and user_id = me;
  perform public.log_chat_action(p_chat, me, me, 'leave', null);
end;
$$;

create or replace function public.delete_chat(p_chat uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.chat_role(p_chat, auth.uid()) is distinct from 'owner' then raise exception 'Удалить может только владелец'; end if;
  delete from public.chats where id = p_chat and type <> 'direct';
end;
$$;

create or replace function public.moderator_delete_message(p_message uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m record; my_role text; sender_role text; c_type text;
begin
  select chat_id, sender_id into m from public.messages where id = p_message;
  if m is null then raise exception 'Сообщение не найдено'; end if;
  select type into c_type from public.chats where id = m.chat_id;
  if c_type = 'direct' then raise exception 'Недоступно для личных чатов'; end if;
  my_role := public.chat_role(m.chat_id, me);
  if public.role_rank(my_role) < 2 then raise exception 'Недостаточно прав'; end if;
  sender_role := coalesce(public.chat_role(m.chat_id, m.sender_id), 'member');
  if m.sender_id <> me and public.role_rank(my_role) <= public.role_rank(sender_role) then
    raise exception 'Нельзя удалить сообщение участника с равными или большими правами';
  end if;
  update public.messages set deleted_for_everyone = true where id = p_message;
  perform public.log_chat_action(m.chat_id, me, m.sender_id, 'delete_message', null);
end;
$$;

create or replace function public.get_chat_audit(p_chat uuid, p_limit integer default 50)
returns table (created_at timestamptz, action text, details text, actor_name text, target_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_chat_staff(p_chat) then raise exception 'Недостаточно прав'; end if;
  return query
    select l.created_at, l.action, l.details,
           nullif(trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), ''),
           nullif(trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')), '')
    from public.chat_audit_log l
    left join public.profiles a on a.id = l.actor_id
    left join public.profiles t on t.id = l.target_id
    where l.chat_id = p_chat
    order by l.created_at desc, l.id desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

-- ---------- 11. Каналы: реакции и комментарии ----------
create or replace function public.react_to_post(p_message uuid, p_value integer)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m record; existing smallint; c_type text;
begin
  if p_value not in (1, -1) then raise exception 'Недопустимая реакция'; end if;
  select chat_id into m from public.messages where id = p_message and deleted_for_everyone = false;
  if m is null then raise exception 'Публикация не найдена'; end if;
  if not public.is_chat_member(m.chat_id) then raise exception 'Нет доступа'; end if;
  select type into c_type from public.chats where id = m.chat_id;
  if c_type <> 'channel' then raise exception 'Реакции доступны только в каналах'; end if;

  select value into existing from public.post_reactions where message_id = p_message and user_id = me;
  if existing is null then
    insert into public.post_reactions (message_id, chat_id, user_id, value) values (p_message, m.chat_id, me, p_value);
  elsif existing = p_value then
    delete from public.post_reactions where message_id = p_message and user_id = me;
  else
    update public.post_reactions set value = p_value where message_id = p_message and user_id = me;
  end if;
end;
$$;

create or replace function public.add_post_comment(p_post uuid, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m record; c record; p record; new_id uuid;
begin
  select chat_id into m from public.messages where id = p_post and deleted_for_everyone = false;
  if m is null then raise exception 'Публикация не найдена'; end if;
  select type, comments_enabled into c from public.chats where id = m.chat_id;
  if c.type <> 'channel' then raise exception 'Комментарии доступны только в каналах'; end if;
  if not c.comments_enabled then raise exception 'Комментарии отключены'; end if;
  select role, muted_until into p from public.chat_participants where chat_id = m.chat_id and user_id = me;
  if p is null then raise exception 'Нет доступа'; end if;
  if p.muted_until is not null and p.muted_until > now() then
    raise exception 'Вы заглушены — осталось % мин.', ceil(extract(epoch from (p.muted_until - now())) / 60.0)::int;
  end if;
  if p_content is null or length(trim(p_content)) = 0 then raise exception 'Пустой комментарий'; end if;
  insert into public.post_comments (post_id, chat_id, user_id, content) values (p_post, m.chat_id, me, trim(p_content))
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.delete_post_comment(p_comment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k record;
begin
  select chat_id, user_id into k from public.post_comments where id = p_comment;
  if k is null then return; end if;
  if k.user_id <> me and public.role_rank(public.chat_role(k.chat_id, me)) < 2 then
    raise exception 'Недостаточно прав';
  end if;
  delete from public.post_comments where id = p_comment;
end;
$$;

-- ---------- 12. Права на вызов ----------
grant execute on function public.create_chat(text, text, text, text, text[]) to authenticated;
grant execute on function public.create_group(text, text, text[]) to authenticated;
grant execute on function public.get_chat_members(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.mute_member(uuid, uuid, integer) to authenticated;
grant execute on function public.kick_member(uuid, uuid) to authenticated;
grant execute on function public.ban_member(uuid, uuid) to authenticated;
grant execute on function public.unban_member(uuid, uuid) to authenticated;
grant execute on function public.update_chat_settings(uuid, text, text, integer, boolean, text) to authenticated;
grant execute on function public.invite_to_chat(uuid, text) to authenticated;
grant execute on function public.respond_chat_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_chat(uuid) to authenticated;
grant execute on function public.delete_chat(uuid) to authenticated;
grant execute on function public.moderator_delete_message(uuid) to authenticated;
grant execute on function public.get_chat_audit(uuid, integer) to authenticated;
grant execute on function public.react_to_post(uuid, integer) to authenticated;
grant execute on function public.add_post_comment(uuid, text) to authenticated;
grant execute on function public.delete_post_comment(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Мои входящие приглашения в группы/каналы (название чата недоступно приглашённому
-- напрямую из-за RLS, поэтому отдаём его через функцию).
create or replace function public.get_my_chat_invites()
returns table (invite_id uuid, chat_id uuid, chat_title text, chat_type text, from_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.chat_id, c.title, c.type,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         i.created_at
  from public.chat_invites i
  join public.chats c on c.id = i.chat_id
  left join public.profiles p on p.id = i.from_user
  where i.to_user = auth.uid() and i.status = 'pending'
  order by i.created_at desc
$$;
grant execute on function public.get_my_chat_invites() to authenticated;
notify pgrst, 'reload schema';

-- Живые обновления: красная точка в Mail, заявки в друзья и приглашения приходят без перезагрузки
do $$
declare t text;
begin
  foreach t in array array['friend_requests', 'chat_invites', 'notifications'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
