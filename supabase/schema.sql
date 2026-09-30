-- =====================================================================
--  «Двое» — схема базы данных Supabase
--  Как применить: Supabase → SQL Editor → New query → вставить файл → Run.
--  Скрипт можно запускать повторно: он пересоздаёт функции и политики.
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

-- ---------------------------------------------------------------------
-- 3. Права доступа (GRANT). С мая 2026 новые проекты Supabase не открывают
--    таблицы для API автоматически — поэтому всё выдаём явно.
--    Роль anon (без входа) не получает доступа ни к одной таблице.
-- ---------------------------------------------------------------------
revoke all on public.pairs, public.profiles, public.user_private, public.mood_entries,
  public.sleep_entries, public.water_logs, public.gratitudes, public.wishes,
  public.questions, public.question_answers, public.day_scores, public.nudges
  from anon, authenticated;

grant all on public.pairs, public.profiles, public.user_private, public.mood_entries,
  public.sleep_entries, public.water_logs, public.gratitudes, public.wishes,
  public.questions, public.question_answers, public.day_scores, public.nudges
  to service_role;

grant select on public.pairs, public.questions to authenticated;
grant select on public.profiles to authenticated;
-- В профиле можно менять только эти колонки; pair_id — только через функции ниже
grant update (display_name, avatar_emoji, water_goal, sleeping_since) on public.profiles to authenticated;
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

-- Серия дней подряд с любой записью в дневнике (для обоих)
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
    select w.user_id, w.day from public.water_logs w, pair where w.pair_id = pair.id and w.day <= p_today and w.glasses > 0
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
                                       'intensity', m.intensity, 'created_at', m.created_at)
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
-- 6. Push-уведомления партнёру через Expo Push API (бесплатно)
-- ---------------------------------------------------------------------
create or replace function public.notify_partner(p_from uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  select up.expo_push_token into v_token
  from public.profiles me
  join public.profiles partner on partner.pair_id = me.pair_id and partner.id <> me.id
  join public.user_private up on up.user_id = partner.id
  where me.id = p_from and me.pair_id is not null
  limit 1;

  if v_token is null or v_token = '' then
    return;
  end if;

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
end;
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

grant execute on function public.my_pair_id() to authenticated;
grant execute on function public.i_answered(date) to authenticated;
grant execute on function public.create_pair() to authenticated;
grant execute on function public.join_pair(text) to authenticated;
grant execute on function public.leave_pair() to authenticated;
grant execute on function public.daily_question(date) to authenticated;
grant execute on function public.answered_days(date, date) to authenticated;
grant execute on function public.pair_streaks(date) to authenticated;
grant execute on function public.partner_snapshot(date) to authenticated;

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
