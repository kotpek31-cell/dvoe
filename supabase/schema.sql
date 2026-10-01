-- =====================================================================
--  «Двое» — схема базы данных Supabase
--  Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
--  Скрипт можно запускать повторно: он пересоздаёт функции и политики.
--
--  Обновление 0.1: чибики в профиле (profiles.chibi), настроение-смесь
--  (mood_entries.emotions), вода больше не влияет на серии, веб-уведомления
--  для iPhone (web_push_subscriptions + Edge Function «push»), уведомление
--  о новом желании партнёра.
--
--  Обновление 0.2 (раздел 10 в конце): каталог вещей, инвентарь, способности,
--  локации пары, секретные коды (только отпечатки), роли разработчиков.
--  После этого файла применить supabase/catalog.sql.
-- =====================================================================

-- Расширение для HTTP-запросов из базы (отправка push через Expo Push API)
create extension if not exists pg_net with schema extensions;

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Пары и профили
-- ---------------------------------------------------------------------
create table if not exists public.pairs (
  id          uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default 'Я' check (char_length(display_name) between 1 and 40),
  avatar_emoji   text not null default '🙂' check (char_length(avatar_emoji) between 1 and 16),
  pair_id        uuid references public.pairs (id) on delete set null,
  water_goal     smallint not null default 8 check (water_goal between 1 and 30),
  sleeping_since timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists profiles_pair_idx on public.profiles (pair_id);

-- 0.1: внешность чибика (JSON). Сейчас только {"kind": "boy" | "girl" | "nb"},
-- позже добавятся причёски, глаза, рост и остальное.
alter table public.profiles add column if not exists chibi jsonb;
alter table public.profiles drop constraint if exists profiles_chibi_check;
alter table public.profiles add constraint profiles_chibi_check check (
  chibi is null or (
    jsonb_typeof(chibi) = 'object'
    and pg_column_size(chibi) <= 4096
    and coalesce(chibi ->> 'kind', 'nb') in ('boy', 'girl', 'nb')
  )
);

-- Приватные данные пользователя (push-токен) — партнёр их не видит
create table if not exists public.user_private (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  expo_push_token text,
  updated_at      timestamptz not null default now()
);

-- id пары текущего пользователя. SECURITY DEFINER — чтобы политики RLS
-- на profiles не вызывали сами себя (бесконечная рекурсия).
create or replace function public.my_pair_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select pair_id from public.profiles where id = auth.uid()
$$;

-- Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(coalesce(new.email, 'Я'), '@', 1)), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для тех, кто успел зарегистрироваться до запуска этого скрипта
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
                          split_part(coalesce(u.email, 'Я'), '@', 1)), 40)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Данные дневника. У каждой строки есть pair_id и user_id;
--    значения по умолчанию подставляет сервер, подделать их нельзя (RLS).
-- ---------------------------------------------------------------------
create table if not exists public.mood_entries (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  emotion     text not null check (char_length(emotion) between 1 and 32),
  sub_emotion text check (char_length(sub_emotion) <= 40),
  intensity   smallint not null check (intensity between 1 and 5),
  note        text check (char_length(note) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists mood_pair_day_idx on public.mood_entries (pair_id, day);

-- 0.1: настроение — смесь эмоций {"joy": 70, "calm": 30, …}, сила каждой 0…100.
-- В emotion/intensity по-прежнему пишется главная эмоция — для старых версий приложения и виджета.
alter table public.mood_entries add column if not exists emotions jsonb;
alter table public.mood_entries drop constraint if exists mood_entries_emotions_check;
alter table public.mood_entries add constraint mood_entries_emotions_check check (
  emotions is null or (
    jsonb_typeof(emotions) = 'object'
    and pg_column_size(emotions) <= 2048
    and not jsonb_path_exists(emotions, '$.* ? (@.type() != "number" || @ < 0 || @ > 100)')
  )
);
-- Оттенков теперь можно выбрать несколько (через запятую) — до 200 символов вместо 40
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.mood_entries'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%sub_emotion%'
  loop
    execute format('alter table public.mood_entries drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.mood_entries add constraint mood_entries_sub_emotion_check
  check (char_length(sub_emotion) <= 200);

create table if not exists public.sleep_entries (
  id           uuid primary key default gen_random_uuid(),
  pair_id      uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day          date not null,                         -- дата пробуждения
  bed_time     timestamptz not null,
  wake_time    timestamptz not null,
  duration_min integer not null check (duration_min between 0 and 1440),
  source       text not null default 'manual'
               check (source in ('android_screen', 'healthkit', 'manual', 'buttons')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, day),
  check (wake_time > bed_time)
);
create index if not exists sleep_pair_day_idx on public.sleep_entries (pair_id, day);

create table if not exists public.water_logs (
  pair_id    uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  glasses    smallint not null default 0 check (glasses between 0 and 40),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists water_pair_day_idx on public.water_logs (pair_id, day);

create table if not exists public.gratitudes (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  text       text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists gratitudes_pair_day_idx on public.gratitudes (pair_id, day);

create table if not exists public.wishes (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,  -- автор
  day        date not null,                                                                 -- когда добавлено
  title      text not null check (char_length(title) between 1 and 200),
  note       text check (char_length(note) <= 1000),
  horizon    text not null default 'today' check (horizon in ('today', 'future')),
  is_done    boolean not null default false,
  done_by    uuid references auth.users (id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wishes_pair_idx on public.wishes (pair_id, is_done);

create table if not exists public.questions (
  id   integer primary key,
  text text not null
);

create table if not exists public.question_answers (
  id          uuid primary key default gen_random_uuid(),
  pair_id     uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  question_id integer not null references public.questions (id),
  answer      text not null check (char_length(answer) between 1 and 2000),
  created_at  timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists answers_pair_day_idx on public.question_answers (pair_id, day);

create table if not exists public.day_scores (
  pair_id    uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  rating     smallint not null check (rating between 1 and 10),
  auto_score numeric(3, 1) check (auto_score between 0 and 10),
  note       text check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists scores_pair_day_idx on public.day_scores (pair_id, day);

create table if not exists public.nudges (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null default public.my_pair_id() references public.pairs (id) on delete cascade,
  from_user  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists nudges_pair_idx on public.nudges (pair_id, created_at desc);

-- 0.1: подписки на веб-уведомления (сайт на экране «Домой» iPhone, браузеры).
-- Напрямую недоступна никому, кроме сервера: пишется только функциями save_web_push / delete_web_push.
create table if not exists public.web_push_subscriptions (
  endpoint   text primary key check (
               char_length(endpoint) <= 1000
               and endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) between 40 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists web_push_user_idx on public.web_push_subscriptions (user_id);

-- ---------------------------------------------------------------------
-- 3. Права доступа (GRANT). С мая 2026 новые проекты Supabase не открывают
--    таблицы для API автоматически — поэтому всё выдаём явно.
--    Роль anon (без входа) не получает доступа ни к одной таблице.
-- ---------------------------------------------------------------------
revoke all on public.pairs, public.profiles, public.user_private, public.mood_entries,
  public.sleep_entries, public.water_logs, public.gratitudes, public.wishes,
  public.questions, public.question_answers, public.day_scores, public.nudges,
  public.web_push_subscriptions
  from anon, authenticated;

grant all on public.pairs, public.profiles, public.user_private, public.mood_entries,
  public.sleep_entries, public.water_logs, public.gratitudes, public.wishes,
  public.questions, public.question_answers, public.day_scores, public.nudges,
  public.web_push_subscriptions
  to service_role;

grant select on public.pairs, public.questions to authenticated;
grant select on public.profiles to authenticated;
-- В профиле можно менять только эти колонки; pair_id — только через функции ниже
grant update (display_name, avatar_emoji, water_goal, sleeping_since, chibi) on public.profiles to authenticated;
grant select, insert, update on public.user_private to authenticated;
grant select, insert, update, delete on public.mood_entries, public.sleep_entries,
  public.water_logs, public.gratitudes, public.wishes, public.day_scores to authenticated;
grant select, insert on public.question_answers, public.nudges to authenticated;

-- ---------------------------------------------------------------------
-- 4. Row Level Security: данные видят только двое участников пары
-- ---------------------------------------------------------------------
alter table public.pairs            enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_private     enable row level security;
alter table public.questions        enable row level security;
alter table public.question_answers enable row level security;
alter table public.wishes           enable row level security;
alter table public.nudges           enable row level security;
-- Политик нет намеренно: клиенты работают с подписками только через функции ниже
alter table public.web_push_subscriptions enable row level security;

drop policy if exists pairs_select on public.pairs;
create policy pairs_select on public.pairs for select to authenticated
  using (id = (select public.my_pair_id()));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (pair_id is not null and pair_id = (select public.my_pair_id())));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists user_private_select on public.user_private;
create policy user_private_select on public.user_private for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists user_private_insert on public.user_private;
create policy user_private_insert on public.user_private for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists user_private_update on public.user_private;
create policy user_private_update on public.user_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions for select to authenticated using (true);

-- Одинаковые правила для личных записей: читать — оба, менять — только автор
do $$
declare t text;
begin
  foreach t in array array['mood_entries', 'sleep_entries', 'water_logs', 'gratitudes', 'day_scores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pair_select on public.%I', t);
    execute format('drop policy if exists own_insert on public.%I', t);
    execute format('drop policy if exists own_update on public.%I', t);
    execute format('drop policy if exists own_delete on public.%I', t);
    execute format($p$create policy pair_select on public.%I for select to authenticated
                      using (pair_id = (select public.my_pair_id()))$p$, t);
    execute format($p$create policy own_insert on public.%I for insert to authenticated
                      with check (user_id = (select auth.uid()) and pair_id = (select public.my_pair_id()))$p$, t);
    execute format($p$create policy own_update on public.%I for update to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()) and pair_id = (select public.my_pair_id()))$p$, t);
    execute format($p$create policy own_delete on public.%I for delete to authenticated
                      using (user_id = (select auth.uid()))$p$, t);
  end loop;
end;
$$;

-- Желания: видят оба; добавляет и удаляет автор; отметить «исполнено» может любой из пары
drop policy if exists wishes_select on public.wishes;
create policy wishes_select on public.wishes for select to authenticated
  using (pair_id = (select public.my_pair_id()));
drop policy if exists wishes_insert on public.wishes;
create policy wishes_insert on public.wishes for insert to authenticated
  with check (user_id = (select auth.uid()) and pair_id = (select public.my_pair_id()));
drop policy if exists wishes_update on public.wishes;
create policy wishes_update on public.wishes for update to authenticated
  using (pair_id = (select public.my_pair_id()))
  with check (pair_id = (select public.my_pair_id()));
drop policy if exists wishes_delete on public.wishes;
create policy wishes_delete on public.wishes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Партнёр может менять в чужом желании только отметку «исполнено»
create or replace function public.wishes_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.pair_id <> old.pair_id then
    raise exception 'Нельзя менять автора желания';
  end if;
  if auth.uid() is not null and old.user_id <> auth.uid()
     and (new.title is distinct from old.title or new.note is distinct from old.note
          or new.horizon is distinct from old.horizon or new.day is distinct from old.day) then
    raise exception 'В желании партнёра можно только поставить отметку «исполнено»';
  end if;
  if new.is_done and not old.is_done then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.is_done then
    new.done_by := null;
    new.done_at := null;
  else
    new.done_by := old.done_by;
    new.done_at := old.done_at;
  end if;
  return new;
end;
$$;

create or replace trigger wishes_guard before update on public.wishes
  for each row execute function public.wishes_guard();

-- Вопрос дня: ответ партнёра виден только после собственного ответа
create or replace function public.i_answered(p_day date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.question_answers where user_id = auth.uid() and day = p_day)
$$;

drop policy if exists answers_select on public.question_answers;
create policy answers_select on public.question_answers for select to authenticated
  using (
    user_id = (select auth.uid())
    or (pair_id = (select public.my_pair_id()) and public.i_answered(day))
  );
drop policy if exists answers_insert on public.question_answers;
create policy answers_insert on public.question_answers for insert to authenticated
  with check (user_id = (select auth.uid()) and pair_id = (select public.my_pair_id()));
-- UPDATE/DELETE нет: ответ окончательный, подсмотреть и переписать нельзя

drop policy if exists nudges_select on public.nudges;
create policy nudges_select on public.nudges for select to authenticated
  using (pair_id = (select public.my_pair_id()));
drop policy if exists nudges_insert on public.nudges;
create policy nudges_insert on public.nudges for insert to authenticated
  with check (from_user = (select auth.uid()) and pair_id = (select public.my_pair_id()));

-- updated_at обновляется автоматически
create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger touch_sleep before update on public.sleep_entries
  for each row execute function public.touch_updated_at();
create or replace trigger touch_water before update on public.water_logs
  for each row execute function public.touch_updated_at();
create or replace trigger touch_scores before update on public.day_scores
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. Функции (RPC) для приложения
-- ---------------------------------------------------------------------

-- Создать пару и получить код-приглашение (6 символов без похожих букв/цифр)
create or replace function public.create_pair()
returns public.pairs
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_pair     public.pairs;
  v_code     text;
  v_bytes    bytea;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 символа
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  if exists (select 1 from public.profiles where id = v_uid and pair_id is not null) then
    raise exception 'Вы уже состоите в паре';
  end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());   -- криптостойкие случайные байты
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.pairs where invite_code = v_code);
  end loop;

  insert into public.pairs (invite_code, created_by) values (v_code, v_uid) returning * into v_pair;
  update public.profiles set pair_id = v_pair.id where id = v_uid;
  return v_pair;
end;
$$;

-- Присоединиться к паре по коду
create or replace function public.join_pair(p_code text)
returns public.pairs
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_pair    public.pairs;
  v_members integer;
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  if exists (select 1 from public.profiles where id = v_uid and pair_id is not null) then
    raise exception 'Вы уже состоите в паре';
  end if;

  select * into v_pair from public.pairs
  where invite_code = upper(replace(trim(coalesce(p_code, '')), ' ', ''))
  for update;
  if not found then
    raise exception 'Код не найден — проверьте его и попробуйте ещё раз';
  end if;

  select count(*) into v_members from public.profiles where pair_id = v_pair.id;
  if v_members >= 2 then
    raise exception 'В этой паре уже двое';
  end if;

  update public.profiles set pair_id = v_pair.id where id = v_uid;
  return v_pair;
end;
$$;

-- Выйти из пары (записи остаются в паре; вернуться можно по тому же коду)
create or replace function public.leave_pair()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set pair_id = null, sleeping_since = null where id = auth.uid();
end;
$$;

-- Вопрос дня: текст, мой ответ, ответил ли партнёр и его ответ (если я уже ответил)
create or replace function public.daily_question(p_day date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_pair    uuid;
  v_count   integer;
  v_q       public.questions;
  v_mine    public.question_answers;
  v_partner public.question_answers;
begin
  select pair_id into v_pair from public.profiles where id = v_uid;
  if v_pair is null then
    raise exception 'Сначала создайте пару';
  end if;

  select count(*) into v_count from public.questions;
  if v_count = 0 then
    return null;
  end if;

  select * into v_mine from public.question_answers where user_id = v_uid and day = p_day;
  select * into v_partner from public.question_answers
    where pair_id = v_pair and day = p_day and user_id <> v_uid
    limit 1;

  if v_mine.id is not null then
    select * into v_q from public.questions where id = v_mine.question_id;
  elsif v_partner.id is not null then
    select * into v_q from public.questions where id = v_partner.question_id;
  else
    select * into v_q from public.questions
      order by id
      offset (abs(p_day - date '2024-01-01') % v_count)
      limit 1;
  end if;

  return jsonb_build_object(
    'question_id',      v_q.id,
    'text',             v_q.text,
    'my_answer',        v_mine.answer,
    'partner_answered', v_partner.id is not null,
    'partner_answer',   case when v_mine.id is not null then v_partner.answer end
  );
end;
$$;

-- В какие дни каждый ответил на вопрос (без текста ответов) — для статистики
create or replace function public.answered_days(p_from date, p_to date)
returns table (user_id uuid, day date)
language sql stable security definer set search_path = ''
as $$
  select qa.user_id, qa.day
  from public.question_answers qa
  where qa.pair_id = public.my_pair_id() and qa.day between p_from and p_to
$$;

-- Серия дней подряд с любой записью в дневнике (для обоих). С 0.1 вода не считается.
create or replace function public.pair_streaks(p_today date)
returns table (user_id uuid, streak integer, filled_today boolean)
language sql stable security definer set search_path = ''
as $$
  with pair as (
    select public.my_pair_id() as id
  ),
  days as (
    select m.user_id, m.day from public.mood_entries m, pair where m.pair_id = pair.id and m.day <= p_today
    union
    select s.user_id, s.day from public.sleep_entries s, pair where s.pair_id = pair.id and s.day <= p_today
    union
    select g.user_id, g.day from public.gratitudes g, pair where g.pair_id = pair.id and g.day <= p_today
    union
    select d.user_id, d.day from public.day_scores d, pair where d.pair_id = pair.id and d.day <= p_today
    union
    select q.user_id, q.day from public.question_answers q, pair where q.pair_id = pair.id and q.day <= p_today
  ),
  islands as (
    select d.user_id, d.day,
           d.day - (row_number() over (partition by d.user_id order by d.day))::integer as grp
    from days d
  ),
  runs as (
    select i.user_id, max(i.day) as last_day, count(*)::integer as len
    from islands i
    group by i.user_id, i.grp
  )
  select p.id,
         coalesce((select r.len from runs r
                   where r.user_id = p.id and r.last_day >= p_today - 1
                   order by r.last_day desc limit 1), 0),
         exists (select 1 from days d where d.user_id = p.id and d.day = p_today)
  from public.profiles p, pair
  where p.pair_id = pair.id
$$;

-- Снимок для виджета: имя, последнее настроение и оценка дня партнёра
create or replace function public.partner_snapshot(p_day date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'partner_id',     p.id,
    'name',           p.display_name,
    'avatar',         p.avatar_emoji,
    'sleeping_since', p.sleeping_since,
    'mood', (select jsonb_build_object('emotion', m.emotion, 'sub_emotion', m.sub_emotion,
                                       'intensity', m.intensity, 'emotions', m.emotions,
                                       'created_at', m.created_at)
             from public.mood_entries m
             where m.user_id = p.id and m.day = p_day
             order by m.created_at desc limit 1),
    'rating',     (select d.rating from public.day_scores d where d.user_id = p.id and d.day = p_day),
    'auto_score', (select d.auto_score from public.day_scores d where d.user_id = p.id and d.day = p_day)
  )
  from public.profiles p
  where p.pair_id = public.my_pair_id() and p.id <> auth.uid()
  limit 1
$$;

-- ---------------------------------------------------------------------
-- 6. Push-уведомления партнёру
--    Android — через Expo Push API (FCM); iPhone-сайт и браузеры — Web Push
--    через Edge Function «push» (сама база шифровать web push не умеет).
-- ---------------------------------------------------------------------

-- Служебные настройки. Схема private не видна через API; читают её только функции ниже.
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.app_config (
  id            smallint primary key default 1 check (id = 1),
  push_url      text not null,                -- адрес Edge Function «push»
  push_secret   text not null,                -- пароль, с которым база обращается к функции
  vapid_public  text,                         -- ключи VAPID: функция создаёт их сама при первом запуске
  vapid_private text,
  vapid_subject text not null default 'https://kotpek31-cell.github.io/dvoe/'
);
alter table private.app_config enable row level security;

insert into private.app_config (id, push_url, push_secret)
values (1, 'https://uvlausosjxzhytzyfduz.supabase.co/functions/v1/push',
        replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function public.notify_partner(p_from uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_partner uuid;
  v_token   text;
  v_subs    jsonb;
  v_url     text;
  v_secret  text;
begin
  select partner.id into v_partner
  from public.profiles me
  join public.profiles partner on partner.pair_id = me.pair_id and partner.id <> me.id
  where me.id = p_from and me.pair_id is not null
  limit 1;
  if v_partner is null then
    return;
  end if;

  -- Телефон (Android-приложение)
  select up.expo_push_token into v_token from public.user_private up where up.user_id = v_partner;
  if coalesce(v_token, '') <> '' then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', v_token,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'sound', 'default',
        'priority', 'high',
        'channelId', 'default'
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      timeout_milliseconds := 5000
    );
  end if;

  -- Сайт на экране «Домой» (iPhone) и браузеры
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
  from (select * from public.web_push_subscriptions
        where user_id = v_partner order by updated_at desc limit 10) s;
  select c.push_url, c.push_secret into v_url, v_secret from private.app_config c where c.id = 1;
  if v_subs is not null and v_url is not null then
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('title', p_title, 'body', p_body, 'data', p_data, 'subscriptions', v_subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      timeout_milliseconds := 10000
    );
  end if;
exception when others then
  -- уведомление не должно мешать сохранить запись
  raise warning 'notify_partner: %', sqlerrm;
end;
$$;

-- Сайт сохраняет подписку этого устройства (на человека — до 5 устройств)
create or replace function public.save_web_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'Этот браузер присылает уведомления через неизвестный сервис';
  end if;
  insert into public.web_push_subscriptions (endpoint, user_id, p256dh, auth, updated_at)
  values (p_endpoint, v_uid, p_p256dh, p_auth, clock_timestamp())
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at;
  delete from public.web_push_subscriptions s
  where s.user_id = v_uid
    and s.endpoint not in (select w.endpoint from public.web_push_subscriptions w
                           where w.user_id = v_uid order by w.updated_at desc limit 5);
end;
$$;

-- Выход из аккаунта: подписка этого устройства больше не нужна
create or replace function public.delete_web_push(p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.web_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- Для Edge Function «push» (только ключ сервера): настройки, первичная запись ключей, очистка
create or replace function public.push_config()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('vapid_public', c.vapid_public, 'vapid_private', c.vapid_private,
                            'vapid_subject', c.vapid_subject, 'push_secret', c.push_secret)
  from private.app_config c
  where c.id = 1
$$;

create or replace function public.push_config_init(p_public text, p_private text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(coalesce(p_public, '')) not between 80 and 100
     or char_length(coalesce(p_private, '')) not between 40 and 50 then
    raise exception 'Неверные ключи VAPID';
  end if;
  -- ключи записываются один раз: подписки браузеров привязаны к ним
  update private.app_config set vapid_public = p_public, vapid_private = p_private
  where id = 1 and vapid_public is null;
  return public.push_config();
end;
$$;

create or replace function public.web_push_gone(p_endpoints text[])
returns void
language sql security definer set search_path = ''
as $$
  delete from public.web_push_subscriptions where endpoint = any (p_endpoints)
$$;

create or replace function public.display_name_of(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((select display_name from public.profiles where id = p_user), 'Партнёр')
$$;

-- «Думаю о тебе»: не чаще одного раза в 3 секунды + push
create or replace function public.nudges_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.nudges
             where from_user = new.from_user and created_at > now() - interval '3 seconds') then
    raise exception 'Слишком часто — подождите пару секунд';
  end if;
  return new;
end;
$$;

create or replace function public.nudges_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_partner(
    new.from_user,
    '💗 Думаю о тебе',
    public.display_name_of(new.from_user) || ' думает о тебе прямо сейчас',
    jsonb_build_object('type', 'nudge')
  );
  return new;
end;
$$;

create or replace trigger nudges_rate_limit before insert on public.nudges
  for each row execute function public.nudges_before_insert();
create or replace trigger nudges_push after insert on public.nudges
  for each row execute function public.nudges_after_insert();

-- Партнёр ответил на вопрос дня
create or replace function public.answers_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_both boolean;
begin
  select exists (select 1 from public.question_answers
                 where pair_id = new.pair_id and day = new.day and user_id <> new.user_id)
    into v_both;
  perform public.notify_partner(
    new.user_id,
    '💬 Вопрос дня',
    case when v_both
      then 'Вы оба ответили — ответы открыты 👀'
      else public.display_name_of(new.user_id) || ' ответил(а) на вопрос дня. Ответь, чтобы увидеть ответ'
    end,
    jsonb_build_object('type', 'question', 'day', new.day)
  );
  return new;
end;
$$;

create or replace trigger answers_push after insert on public.question_answers
  for each row execute function public.answers_after_insert();

-- Партнёр исполнил твоё желание
create or replace function public.wishes_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_done and not old.is_done and new.done_by is not null and new.done_by <> new.user_id then
    perform public.notify_partner(
      new.done_by,
      '🎁 Желание исполнено',
      public.display_name_of(new.done_by) || ' исполнил(а) твоё желание: «' || left(new.title, 80) || '»',
      jsonb_build_object('type', 'wish', 'wish_id', new.id)
    );
  end if;
  return new;
end;
$$;

create or replace trigger wishes_push after update on public.wishes
  for each row execute function public.wishes_after_update();

-- Партнёр загадал желание (если загадывает несколько подряд — одно уведомление в минуту)
create or replace function public.wishes_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.wishes
             where user_id = new.user_id and id <> new.id and created_at > now() - interval '1 minute') then
    return new;
  end if;
  perform public.notify_partner(
    new.user_id,
    '🎁 Новое желание',
    public.display_name_of(new.user_id) || ' загадывает: «' || left(new.title, 80) || '»',
    jsonb_build_object('type', 'wish', 'wish_id', new.id)
  );
  return new;
end;
$$;

create or replace trigger wishes_push_new after insert on public.wishes
  for each row execute function public.wishes_after_insert();

-- ---------------------------------------------------------------------
-- 7. Права на функции: клиентам доступны только нужные RPC
-- ---------------------------------------------------------------------
revoke execute on function public.my_pair_id() from public, anon;
revoke execute on function public.i_answered(date) from public, anon;
revoke execute on function public.create_pair() from public, anon;
revoke execute on function public.join_pair(text) from public, anon;
revoke execute on function public.leave_pair() from public, anon;
revoke execute on function public.daily_question(date) from public, anon;
revoke execute on function public.answered_days(date, date) from public, anon;
revoke execute on function public.pair_streaks(date) from public, anon;
revoke execute on function public.partner_snapshot(date) from public, anon;
revoke execute on function public.notify_partner(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.display_name_of(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.save_web_push(text, text, text) from public, anon;
revoke execute on function public.delete_web_push(text) from public, anon;
revoke execute on function public.push_config() from public, anon, authenticated;
revoke execute on function public.push_config_init(text, text) from public, anon, authenticated;
revoke execute on function public.web_push_gone(text[]) from public, anon, authenticated;

grant execute on function public.my_pair_id() to authenticated;
grant execute on function public.i_answered(date) to authenticated;
grant execute on function public.create_pair() to authenticated;
grant execute on function public.join_pair(text) to authenticated;
grant execute on function public.leave_pair() to authenticated;
grant execute on function public.daily_question(date) to authenticated;
grant execute on function public.answered_days(date, date) to authenticated;
grant execute on function public.pair_streaks(date) to authenticated;
grant execute on function public.partner_snapshot(date) to authenticated;
grant execute on function public.save_web_push(text, text, text) to authenticated;
grant execute on function public.delete_web_push(text) to authenticated;
grant execute on function public.push_config() to service_role;
grant execute on function public.push_config_init(text, text) to service_role;
grant execute on function public.web_push_gone(text[]) to service_role;

-- ---------------------------------------------------------------------
-- 8. Realtime: изменения этих таблиц мгновенно приходят в приложение
--    (Realtime проверяет те же RLS-политики)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'mood_entries', 'sleep_entries', 'water_logs', 'gratitudes',
                           'wishes', 'question_answers', 'day_scores', 'nudges'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Вопросы дня (можно дописывать свои — id должен быть уникальным)
-- ---------------------------------------------------------------------
insert into public.questions (id, text) values
  (1,  'Что сегодня заставило тебя улыбнуться?'),
  (2,  'Какой момент нашего знакомства ты вспоминаешь чаще всего?'),
  (3,  'Чего тебе сейчас больше всего не хватает?'),
  (4,  'Что бы ты хотел(а) попробовать вместе в этом месяце?'),
  (5,  'Какая у тебя самая странная привычка?'),
  (6,  'Чем ты сегодня гордишься?'),
  (7,  'Какое место ты мечтаешь посетить вдвоём?'),
  (8,  'Какая песня ассоциируется у тебя со мной?'),
  (9,  'Что тебя сейчас тревожит больше всего?'),
  (10, 'Как выглядит твой идеальный выходной?'),
  (11, 'Что ты ценишь во мне, но редко говоришь?'),
  (12, 'Какое детское воспоминание для тебя самое тёплое?'),
  (13, 'Если бы у нас был целый свободный день, как бы ты его провёл(а)?'),
  (14, 'Какой подарок без повода ты бы хотел(а) получить?'),
  (15, 'Чему ты хочешь научиться в этом году?'),
  (16, 'Что для тебя значит «уют»?'),
  (17, 'О чём ты давно хотел(а) меня спросить?'),
  (18, 'Какой фильм ты готов(а) пересматривать бесконечно?'),
  (19, 'Что помогает тебе успокоиться после тяжёлого дня?'),
  (20, 'Какое блюдо нам стоит приготовить вместе?'),
  (21, 'Что тебя удивило во мне?'),
  (22, 'О какой своей мечте ты почти никому не рассказывал(а)?'),
  (23, 'Когда ты в последний раз чувствовал(а) себя по-настоящему счастливым(ой)?'),
  (24, 'Что бы ты сказал(а) себе десятилетнему(ей)?'),
  (25, 'Какая мелочь от меня радует тебя больше всего?'),
  (26, 'Каким ты видишь наш следующий год?'),
  (27, 'Какое свидание ты считаешь идеальным?'),
  (28, 'Какой твой любимый запах?'),
  (29, 'Что сегодня было самым трудным?'),
  (30, 'Какую традицию ты хотел(а) бы завести у нас?'),
  (31, 'За что ты благодарен(на) своим родителям?'),
  (32, 'Какой суперсилой ты хотел(а) бы обладать?'),
  (33, 'Как ты понимаешь, что тебя любят?'),
  (34, 'Какой совет ты бы дал(а) нам как паре?'),
  (35, 'Что тебя вдохновляет в последнее время?'),
  (36, 'Какую книгу или сериал ты посоветуешь мне?'),
  (37, 'Что тебя больше всего раздражает в быту?'),
  (38, 'Какой момент этой недели ты хотел(а) бы повторить?'),
  (39, 'Какое решение в жизни ты считаешь самым смелым?'),
  (40, 'Что ты делаешь, когда тебе грустно?'),
  (41, 'Если бы мы жили в другой стране, то в какой?'),
  (42, 'Какое у тебя любимое время года и почему?'),
  (43, 'Что ты хотел(а) бы изменить в своём распорядке дня?'),
  (44, 'Какой комплимент тебе запомнился больше всего?'),
  (45, 'Что бы ты сделал(а), если бы точно знал(а), что не ошибёшься?'),
  (46, 'Какой звук тебя успокаивает?'),
  (47, 'Что ты хочешь, чтобы я знал(а) о тебе прямо сейчас?'),
  (48, 'Кем ты мечтал(а) стать в детстве?'),
  (49, 'Какой самый смешной момент был у нас?'),
  (50, 'Что может мгновенно тебя рассмешить?'),
  (51, 'Каким должно быть твоё идеальное утро?'),
  (52, 'Что для тебя значит поддержка?'),
  (53, 'Какую одну вещь ты взял(а) бы на необитаемый остров?'),
  (54, 'Что нового ты узнал(а) на этой неделе?'),
  (55, 'Каким был бы твой идеальный дом?'),
  (56, 'Чего ты ждёшь от завтрашнего дня?'),
  (57, 'Какое наше совместное фото тебе нравится больше всего?'),
  (58, 'Что ты чувствуешь, когда мы долго не видимся?'),
  (59, 'Какая черта характера тебе в себе нравится?'),
  (60, 'Какой маленький шаг к мечте ты можешь сделать завтра?')
on conflict (id) do update set text = excluded.text;

-- =====================================================================
-- 10. Обновление 0.2 — «Гардероб и способности»
--     Каталог вещей, инвентарь, способности, локации пары, секретные коды,
--     роли разработчиков. Всё, что даёт вещи, проверяет сервер.
--     После этого блока применить supabase/catalog.sql (стартовые вещи).
--     Старые таблицы и функции 0.1 не меняются — версия 0.1.1 работает как раньше.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 10.1 Каталог вещей и способностей (рисунок — слои SVG или картинка в art)
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id         text primary key check (id ~ '^[a-z]+\.[a-z0-9_]+$' and char_length(id) <= 40),
  cat        text not null check (cat in ('hair', 'eyes', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'hand', 'ability')),
  name       text not null check (char_length(name) between 1 and 60),
  rarity     smallint not null default 0 check (rarity between 0 and 5),   -- названия редкостей появятся позже
  source     text not null default 'free' check (source in ('free', 'code', 'shop', 'dev')),
  palette    text check (palette in ('cloth', 'hair')),                     -- null — не перекрашивается
  def_color  text check (char_length(def_color) <= 20),
  sort       integer not null default 0,
  art        jsonb not null default '{}'::jsonb check (jsonb_typeof(art) = 'object' and pg_column_size(art) <= 65536),
  meta       jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Небесплатные вещи человека (бесплатные есть у всех и сюда не пишутся)
create table if not exists public.inventory (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null references public.items (id) on delete cascade,
  source     text not null check (source in ('code', 'dev', 'shop')),
  code_id    uuid,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- 10.2 Локации: одна на пару. Рисунки — в приложении, здесь список и доступ.
-- ---------------------------------------------------------------------
create table if not exists public.locations (
  id              text primary key check (id ~ '^[a-z_]+$' and char_length(id) <= 30),
  name            text not null check (char_length(name) between 1 and 60),
  sort            integer not null default 0,
  open_by_default boolean not null default true    -- false — откроется за мини-игру (позже)
);

insert into public.locations (id, name, sort, open_by_default) values
  ('meadow', 'Луг у озера',     10, true),
  ('aurora', 'Северное сияние', 20, true),
  ('roof',   'Крыша города',    30, true),
  ('beach',  'Пляж',            40, true)
on conflict (id) do update set name = excluded.name, sort = excluded.sort, open_by_default = excluded.open_by_default;

-- Закрытые по умолчанию локации, которые пара уже открыла
create table if not exists public.pair_locations (
  pair_id     uuid not null references public.pairs (id) on delete cascade,
  location_id text not null references public.locations (id) on delete cascade,
  opened_at   timestamptz not null default now(),
  primary key (pair_id, location_id)
);

alter table public.pairs add column if not exists location text not null default 'meadow' references public.locations (id);

-- ---------------------------------------------------------------------
-- 10.3 Применения способностей: кто, кому, что, когда, видел ли партнёр
-- ---------------------------------------------------------------------
create table if not exists public.ability_casts (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null references public.pairs (id) on delete cascade,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  ability    text not null references public.items (id),
  pushed     boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists casts_to_idx on public.ability_casts (to_user, created_at desc);
create index if not exists casts_from_idx on public.ability_casts (from_user, ability, created_at desc);
create index if not exists casts_created_idx on public.ability_casts (created_at);

-- ---------------------------------------------------------------------
-- 10.4 Закрытая схема: роли, секретные коды, попытки ввода.
--      Через API не видна; читают и пишут только функции ниже.
--      В таблице кодов лежит не код, а его отпечаток HMAC-SHA256 с солью сервера.
-- ---------------------------------------------------------------------
create table if not exists private.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'developer')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_roles_one_owner on private.user_roles ((true)) where role = 'owner';

create table if not exists private.codes (
  id         uuid primary key default gen_random_uuid(),
  fp         text not null unique,                 -- отпечаток кода, сам код нигде не хранится
  title      text not null check (char_length(title) between 1 and 60),
  is_core    boolean not null default false,       -- Core: получает только первый, кто ввёл
  rewards    text[] not null check (cardinality(rewards) between 1 and 30),
  active     boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists private.code_redemptions (
  code_id    uuid not null references private.codes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  core       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (code_id, user_id)
);
-- Core-код физически нельзя получить дважды, даже при одновременном вводе
create unique index if not exists code_redemptions_core on private.code_redemptions (code_id) where core;

create table if not exists private.code_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists code_attempts_user_idx on private.code_attempts (user_id, created_at);

alter table private.user_roles       enable row level security;
alter table private.codes            enable row level security;
alter table private.code_redemptions enable row level security;
alter table private.code_attempts    enable row level security;

-- Соль для отпечатков кодов: создаётся один раз и больше не меняется
alter table private.app_config add column if not exists code_salt text;
update private.app_config set code_salt = encode(extensions.gen_random_bytes(32), 'hex')
where id = 1 and code_salt is null;

-- ---------------------------------------------------------------------
-- 10.5 Права и RLS на новые таблицы
-- ---------------------------------------------------------------------
revoke all on public.items, public.inventory, public.locations, public.pair_locations, public.ability_casts
  from anon, authenticated;
grant all on public.items, public.inventory, public.locations, public.pair_locations, public.ability_casts
  to service_role;
-- Клиенты только читают; всё остальное — через функции
grant select on public.items, public.inventory, public.locations, public.pair_locations, public.ability_casts
  to authenticated;

alter table public.items          enable row level security;
alter table public.inventory      enable row level security;
alter table public.locations      enable row level security;
alter table public.pair_locations enable row level security;
alter table public.ability_casts  enable row level security;

-- Каталог читают все вошедшие: чтобы нарисовать и свои вещи, и вещи партнёра
drop policy if exists items_select on public.items;
create policy items_select on public.items for select to authenticated using (true);

drop policy if exists inventory_select on public.inventory;
create policy inventory_select on public.inventory for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated using (true);

drop policy if exists pair_locations_select on public.pair_locations;
create policy pair_locations_select on public.pair_locations for select to authenticated
  using (pair_id = (select public.my_pair_id()));

drop policy if exists casts_select on public.ability_casts;
create policy casts_select on public.ability_casts for select to authenticated
  using (pair_id = (select public.my_pair_id()));

create or replace trigger touch_items before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 10.6 Служебные функции (закрытая схема)
-- ---------------------------------------------------------------------

-- Отпечаток кода: регистр и пробелы по краям не важны
create or replace function private.code_fp(p_code text)
returns text
language sql stable security definer set search_path = ''
as $$
  select encode(extensions.hmac(convert_to(lower(btrim(coalesce(p_code, ''), E' \t\r\n')), 'UTF8'),
                                convert_to(c.code_salt, 'UTF8'), 'sha256'), 'hex')
  from private.app_config c
  where c.id = 1
$$;

-- Есть ли у человека вещь: бесплатная или в инвентаре
create or replace function private.has_item(p_user uuid, p_item text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.items i
    where i.id = p_item
      and (i.source = 'free'
           or exists (select 1 from public.inventory v where v.user_id = p_user and v.item_id = i.id))
  )
$$;

-- Палитры по 10 цветов (сами оттенки — в приложении)
create or replace function private.color_ok(p_palette text, p_color text)
returns boolean
language sql immutable set search_path = ''
as $$
  select case p_palette
    when 'cloth' then p_color = any (array['coal', 'milk', 'strawberry', 'cherry', 'apricot',
                                           'lemon', 'mint', 'sky', 'blueberry', 'lavender'])
    when 'hair'  then p_color = any (array['coal', 'chocolate', 'chestnut', 'caramel', 'blond',
                                           'ginger', 'plum', 'pink', 'blue', 'silver'])
    else false
  end
$$;

-- Проверка роли: каждая функция комнаты разработчиков начинается с неё
create or replace function private.require_role(p_owner_only boolean default false)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
       select 1 from private.user_roles r
       where r.user_id = v_uid and (not p_owner_only or r.role = 'owner')) then
    raise exception 'Нет доступа' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Создать код. Вызывается из комнаты разработчиков или через коннектор Supabase:
--   select private.create_code('<код>', '<название набора>', array['<id вещи>', ...]);
-- Core определяется сам: код заканчивается на «core» (без учёта регистра).
create or replace function private.create_code(p_code text, p_title text, p_rewards text[], p_by uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_norm text := lower(btrim(coalesce(p_code, ''), E' \t\r\n'));
  v_bad  text;
  v_id   uuid;
begin
  if char_length(v_norm) not between 4 and 100 then
    raise exception 'Код должен быть от 4 до 100 символов';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'Нужно название набора (до 60 символов)';
  end if;
  if coalesce(cardinality(p_rewards), 0) = 0 then
    raise exception 'Код должен что-то давать';
  end if;
  select string_agg(r, ', ') into v_bad
  from unnest(p_rewards) r
  where not exists (select 1 from public.items i where i.id = r);
  if v_bad is not null then
    raise exception 'Таких вещей нет в каталоге: %', v_bad;
  end if;
  if exists (select 1 from private.codes where fp = private.code_fp(v_norm)) then
    raise exception 'Такой код уже есть';
  end if;
  insert into private.codes (fp, title, is_core, rewards, created_by)
  values (private.code_fp(v_norm), btrim(p_title), v_norm like '%core',
          array(select distinct r from unnest(p_rewards) r), p_by)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 10.7 Образ чибика: сервер проверяет каждую надетую вещь
--      profiles.chibi = {"kind", "v": 2, "skin": 0..4, "hair": {"id", "c"}, "eyes", "hat", "face",
--                        "top", "bottom", "shoes", "back", "hand", "ability": "ability.hug"}
--      Старая версия пишет только {"kind"} — это по-прежнему разрешено.
-- ---------------------------------------------------------------------
create or replace function public.profiles_chibi_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  k   text;
  val jsonb;
  it  public.items;
begin
  if new.chibi is null or new.chibi is not distinct from old.chibi or auth.uid() is null then
    return new;
  end if;
  for k, val in select e.key, e.value from jsonb_each(new.chibi) e loop
    -- что уже было надето, не перепроверяем (вещь могли забрать — образ всё равно сохранится)
    continue when old.chibi is not null and (old.chibi -> k) is not distinct from val;
    if k in ('kind', 'v') then
      continue;  -- kind проверяет ограничение profiles_chibi_check
    elsif k = 'skin' then
      if jsonb_typeof(val) <> 'number' or val::numeric not in (0, 1, 2, 3, 4) then
        raise exception 'Неверный тон кожи';
      end if;
    elsif k = 'ability' then
      select * into it from public.items i where i.id = val #>> '{}' and i.cat = 'ability';
      if jsonb_typeof(val) <> 'string' or it.id is null or not private.has_item(new.id, it.id) then
        raise exception 'Этой способности нет в инвентаре';
      end if;
    elsif k = any (array['hair', 'eyes', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'hand']) then
      continue when jsonb_typeof(val) = 'null';
      if jsonb_typeof(val) <> 'object' or exists (select 1 from jsonb_object_keys(val) x where x not in ('id', 'c')) then
        raise exception 'Неверное описание вещи в образе';
      end if;
      select * into it from public.items i where i.id = val ->> 'id';
      if it.id is null or it.cat <> k then
        raise exception 'Неизвестная вещь: %', coalesce(val ->> 'id', '—');
      end if;
      if not private.has_item(new.id, it.id) then
        raise exception 'Вещи «%» нет в инвентаре', it.name;
      end if;
      if jsonb_typeof(val -> 'c') not in ('null') and not private.color_ok(it.palette, val ->> 'c') then
        raise exception 'Вещь «%» нельзя перекрасить в этот цвет', it.name;
      end if;
    else
      raise exception 'Лишнее поле в образе: %', k;
    end if;
  end loop;
  return new;
end;
$$;

create or replace trigger profiles_chibi_guard before update of chibi on public.profiles
  for each row execute function public.profiles_chibi_guard();

-- ---------------------------------------------------------------------
-- 10.8 Функции для приложения
-- ---------------------------------------------------------------------

-- Ввести секретный код. Ошибки возвращаются ответом, а не исключением,
-- чтобы неверная попытка записалась (лимит: 5 неверных за 10 минут).
create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_fails integer;
  v_first timestamptz;
  v_wait  integer;
  v_code  private.codes;
  v_items jsonb;
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select count(*), min(a.created_at) into v_fails, v_first
  from private.code_attempts a
  where a.user_id = v_uid and a.created_at > now() - interval '10 minutes';
  if v_fails >= 5 then
    v_wait := greatest(1, ceil(extract(epoch from (v_first + interval '10 minutes' - now())) / 60)::integer);
    return jsonb_build_object('ok', false, 'error', 'rate', 'wait_min', v_wait,
                              'message', 'Слишком много попыток. Попробуй через ' || v_wait || ' мин');
  end if;

  if char_length(btrim(coalesce(p_code, ''))) between 1 and 100 then
    select * into v_code from private.codes c
    where c.fp = private.code_fp(p_code) and c.active
    for update;
  end if;
  if v_code.id is null then
    insert into private.code_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Код не найден');
  end if;

  if exists (select 1 from private.code_redemptions r where r.code_id = v_code.id and r.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already', 'message', 'Ты уже вводил этот код');
  end if;
  if v_code.is_core and exists (select 1 from private.code_redemptions r where r.code_id = v_code.id) then
    return jsonb_build_object('ok', false, 'error', 'taken', 'message', 'Этот код уже забрали');
  end if;

  begin
    insert into private.code_redemptions (code_id, user_id, core) values (v_code.id, v_uid, v_code.is_core);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken', 'message', 'Этот код уже забрали');
  end;

  insert into public.inventory (user_id, item_id, source, code_id)
  select v_uid, i.id, 'code', v_code.id
  from public.items i
  where i.id = any (v_code.rewards) and i.source <> 'free'
  on conflict (user_id, item_id) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'cat', i.cat, 'name', i.name) order by i.cat, i.sort), '[]'::jsonb)
    into v_items
  from public.items i
  where i.id = any (v_code.rewards);

  return jsonb_build_object('ok', true, 'title', v_code.title, 'items', v_items);
end;
$$;

-- Применить надетую способность к партнёру
create or replace function public.cast_ability(p_ability text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_me      public.profiles;
  v_partner public.profiles;
  v_item    public.items;
  v_cd      integer;
  v_every   integer;
  v_last    timestamptz;
  v_push    boolean;
  v_cast    public.ability_casts;
  v_name    text;
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  -- блокировка своей строки: два нажатия подряд не обойдут перезарядку
  select * into v_me from public.profiles where id = v_uid for update;
  if v_me.pair_id is not null then
    select * into v_partner from public.profiles
    where pair_id = v_me.pair_id and id <> v_uid
    limit 1;
  end if;
  if v_partner.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_partner', 'message', 'Сначала нужна пара');
  end if;

  select * into v_item from public.items where id = p_ability and cat = 'ability';
  if v_item.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown', 'message', 'Такой способности нет');
  end if;
  if coalesce(v_me.chibi ->> 'ability', 'ability.hug') <> v_item.id then
    return jsonb_build_object('ok', false, 'error', 'not_equipped', 'message', 'Сначала надень эту способность');
  end if;
  if not private.has_item(v_uid, v_item.id) then
    return jsonb_build_object('ok', false, 'error', 'not_owned', 'message', 'Этой способности нет в инвентаре');
  end if;
  if v_partner.sleeping_since is not null then
    return jsonb_build_object('ok', false, 'error', 'partner_sleeping',
                              'message', 'Тсс, ' || v_partner.display_name || ' спит');
  end if;

  v_cd := coalesce((v_item.meta ->> 'cooldown_s')::integer, 10);
  select max(c.created_at) into v_last
  from public.ability_casts c
  where c.from_user = v_uid and c.ability = v_item.id;
  if v_last is not null and v_last > now() - make_interval(secs => v_cd) then
    return jsonb_build_object('ok', false, 'error', 'cooldown',
                              'wait_s', ceil(extract(epoch from (v_last + make_interval(secs => v_cd) - now())))::integer,
                              'message', 'Способность ещё перезаряжается');
  end if;

  -- пуш: «Мог» — всегда, «Объятия» — не чаще раза в push_every_s секунд
  v_every := coalesce((v_item.meta ->> 'push_every_s')::integer, 0);
  v_push := v_every = 0 or not exists (
    select 1 from public.ability_casts c
    where c.from_user = v_uid and c.ability = v_item.id and c.pushed
      and c.created_at > now() - make_interval(secs => v_every));

  insert into public.ability_casts (pair_id, from_user, to_user, ability, pushed)
  values (v_me.pair_id, v_uid, v_partner.id, v_item.id, v_push)
  returning * into v_cast;

  if v_push then
    v_name := v_me.display_name;
    perform public.notify_partner(
      v_uid,
      v_item.name,
      case v_item.id
        when 'ability.hug' then v_name || ' обнимает тебя'
        else v_name || ' применяет «' || v_item.name || '». Открой, чтобы увидеть'
      end,
      jsonb_build_object('type', 'cast', 'ability', v_item.id, 'cast_id', v_cast.id)
    );
  end if;

  return jsonb_build_object('ok', true, 'id', v_cast.id, 'created_at', v_cast.created_at, 'cooldown_s', v_cd);
end;
$$;

-- Сцены, которые мне показали, пока приложение было закрыто (за последние сутки)
create or replace function public.pending_casts()
returns setof public.ability_casts
language sql stable security definer set search_path = ''
as $$
  select * from public.ability_casts c
  where c.to_user = auth.uid() and c.seen_at is null and c.created_at > now() - interval '1 day'
  order by c.created_at
$$;

create or replace function public.mark_casts_seen(p_ids uuid[])
returns integer
language sql security definer set search_path = ''
as $$
  with done as (
    update public.ability_casts set seen_at = now()
    where id = any (p_ids) and to_user = auth.uid() and seen_at is null
    returning 1
  )
  select count(*)::integer from done
$$;

-- Сменить локацию пары (партнёр увидит сразу — realtime на pairs)
create or replace function public.set_location(p_location text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_pair uuid := public.my_pair_id();
begin
  if v_pair is null then
    raise exception 'Сначала создайте пару';
  end if;
  if not exists (
       select 1 from public.locations l
       where l.id = p_location
         and (l.open_by_default
              or exists (select 1 from public.pair_locations pl where pl.pair_id = v_pair and pl.location_id = l.id))) then
    raise exception 'Эта локация пока закрыта';
  end if;
  update public.pairs set location = p_location where id = v_pair;
  return p_location;
end;
$$;

-- Моя роль: 'owner', 'developer' или null
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select r.role from private.user_roles r where r.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 10.9 Комната разработчиков: каждая функция сначала проверяет роль
-- ---------------------------------------------------------------------

-- Найти человека по email: профиль, роль, инвентарь
create or replace function public.dev_find_user(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user auth.users;
begin
  perform private.require_role();
  select * into v_user from auth.users u where lower(u.email) = lower(btrim(coalesce(p_email, '')));
  if v_user.id is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'display_name', p.display_name,
      'pair_id', p.pair_id,
      'role', (select r.role from private.user_roles r where r.user_id = v_user.id),
      'inventory', coalesce((select jsonb_agg(jsonb_build_object('item_id', v.item_id, 'source', v.source, 'granted_at', v.granted_at)
                                              order by v.granted_at)
                             from public.inventory v where v.user_id = v_user.id), '[]'::jsonb)
    )
    from public.profiles p where p.id = v_user.id
  );
end;
$$;

create or replace function public.dev_grant_item(p_user uuid, p_item text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev uuid := private.require_role();
begin
  if not exists (select 1 from public.items where id = p_item) then
    raise exception 'Такой вещи нет в каталоге';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Такого аккаунта нет';
  end if;
  insert into public.inventory (user_id, item_id, source, granted_by)
  values (p_user, p_item, 'dev', v_dev)
  on conflict (user_id, item_id) do nothing;
end;
$$;

-- Забрать вещь: если она надета — снимается
create or replace function public.dev_revoke_item(p_user uuid, p_item text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_cat text;
begin
  perform private.require_role();
  delete from public.inventory where user_id = p_user and item_id = p_item;
  select cat into v_cat from public.items where id = p_item;
  if v_cat = 'ability' then
    update public.profiles set chibi = chibi - 'ability'
    where id = p_user and chibi ->> 'ability' = p_item;
  elsif v_cat is not null then
    update public.profiles set chibi = chibi - v_cat
    where id = p_user and chibi -> v_cat ->> 'id' = p_item;
  end if;
end;
$$;

create or replace function public.dev_create_code(p_code text, p_title text, p_rewards text[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev uuid := private.require_role();
begin
  return private.create_code(p_code, p_title, p_rewards, v_dev);
end;
$$;

-- Список кодов (без самих кодов): сколько раз введён, кто и когда
create or replace function public.dev_list_codes()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_role();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'title', c.title, 'is_core', c.is_core, 'active', c.active,
             'rewards', to_jsonb(c.rewards), 'created_at', c.created_at,
             'count', (select count(*) from private.code_redemptions r where r.code_id = c.id),
             'redeemed', coalesce((
               select jsonb_agg(jsonb_build_object('name', p.display_name, 'email', u.email, 'at', r.created_at)
                                order by r.created_at desc)
               from (select * from private.code_redemptions r2 where r2.code_id = c.id
                     order by r2.created_at desc limit 50) r
               left join public.profiles p on p.id = r.user_id
               left join auth.users u on u.id = r.user_id), '[]'::jsonb))
           order by c.created_at desc)
    from private.codes c), '[]'::jsonb);
end;
$$;

-- Выключить или включить код (полученные вещи остаются у людей)
create or replace function public.dev_set_code_active(p_code_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_role();
  update private.codes set active = p_active where id = p_code_id;
end;
$$;

-- Общая статистика. «Сегодня» — по московскому времени.
create or replace function public.dev_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
  v_week  timestamptz := now() - interval '7 days';
begin
  perform private.require_role();
  return (
    with acts as (
      select pair_id, user_id, created_at from public.mood_entries
      union all select pair_id, user_id, created_at from public.sleep_entries
      union all select pair_id, user_id, created_at from public.gratitudes
      union all select pair_id, user_id, updated_at from public.day_scores
      union all select pair_id, user_id, created_at from public.question_answers
      union all select pair_id, user_id, created_at from public.wishes
    )
    select jsonb_build_object(
      'accounts',       (select count(*) from public.profiles),
      'pairs',          (select count(*) from (select pair_id from public.profiles where pair_id is not null
                                               group by pair_id having count(*) = 2) x),
      'active_pairs_7d', (select count(distinct pair_id) from acts where created_at >= v_week),
      'active_today',   (select count(distinct user_id) from acts where created_at >= v_today),
      'casts_today',    (select count(*) from public.ability_casts where created_at >= v_today),
      'codes_today',    (select count(*) from private.code_redemptions where created_at >= v_today)
    )
  );
end;
$$;

-- Разработчики (только владелец)
create or replace function public.dev_list_developers()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_role(true);
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'role', r.role, 'email', u.email,
                                        'name', p.display_name, 'since', r.created_at)
                     order by r.role desc, r.created_at)
    from private.user_roles r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id), '[]'::jsonb);
end;
$$;

create or replace function public.dev_set_developer(p_email text, p_on boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := private.require_role(true);
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user is null then
    raise exception 'Аккаунт с таким email не найден';
  end if;
  if v_user = v_owner then
    raise exception 'Роль владельца так не меняется';
  end if;
  if p_on then
    insert into private.user_roles (user_id, role, granted_by) values (v_user, 'developer', v_owner)
    on conflict (user_id) do nothing;
  else
    delete from private.user_roles where user_id = v_user and role = 'developer';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 10.10 Права на новые функции
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function public.profiles_chibi_guard() from public, anon, authenticated;
-- триггерные функции 0.1 тоже не должны вызываться через API
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.wishes_guard() from public, anon, authenticated;
revoke execute on function public.nudges_before_insert() from public, anon, authenticated;
revoke execute on function public.nudges_after_insert() from public, anon, authenticated;
revoke execute on function public.answers_after_insert() from public, anon, authenticated;
revoke execute on function public.wishes_after_insert() from public, anon, authenticated;
revoke execute on function public.wishes_after_update() from public, anon, authenticated;
revoke execute on function public.redeem_code(text) from public, anon;
revoke execute on function public.cast_ability(text) from public, anon;
revoke execute on function public.pending_casts() from public, anon;
revoke execute on function public.mark_casts_seen(uuid[]) from public, anon;
revoke execute on function public.set_location(text) from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.dev_find_user(text) from public, anon;
revoke execute on function public.dev_grant_item(uuid, text) from public, anon;
revoke execute on function public.dev_revoke_item(uuid, text) from public, anon;
revoke execute on function public.dev_create_code(text, text, text[]) from public, anon;
revoke execute on function public.dev_list_codes() from public, anon;
revoke execute on function public.dev_set_code_active(uuid, boolean) from public, anon;
revoke execute on function public.dev_stats() from public, anon;
revoke execute on function public.dev_list_developers() from public, anon;
revoke execute on function public.dev_set_developer(text, boolean) from public, anon;

grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.cast_ability(text) to authenticated;
grant execute on function public.pending_casts() to authenticated;
grant execute on function public.mark_casts_seen(uuid[]) to authenticated;
grant execute on function public.set_location(text) to authenticated;
grant execute on function public.my_role() to authenticated;
-- dev_* открыты вошедшим, но внутри каждой — проверка роли на сервере
grant execute on function public.dev_find_user(text) to authenticated;
grant execute on function public.dev_grant_item(uuid, text) to authenticated;
grant execute on function public.dev_revoke_item(uuid, text) to authenticated;
grant execute on function public.dev_create_code(text, text, text[]) to authenticated;
grant execute on function public.dev_list_codes() to authenticated;
grant execute on function public.dev_set_code_active(uuid, boolean) to authenticated;
grant execute on function public.dev_stats() to authenticated;
grant execute on function public.dev_list_developers() to authenticated;
grant execute on function public.dev_set_developer(text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 10.11 Realtime: применения способностей и смена локации приходят сразу
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ability_casts', 'pairs', 'inventory'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Готово. Если внизу видна эта строка — схема применена целиком.
select 'Схема «Двое» 0.2 применена' as "Готово";
