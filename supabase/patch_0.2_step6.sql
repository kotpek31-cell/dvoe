-- «Двое» 0.2, шаг 6 — то, что коннектор Supabase не применяет из облачной сессии
-- (на словах delete/revoke он ждёт подтверждения и падает по тайм-ауту).
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run (если спросит про RLS — «Run without RLS»).
-- Можно запускать повторно. Остальное из шага 6 уже применено.

-- Снять роль (только владелец)
create or replace function public.dev_remove_role(p_query text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid := private.require_role(true);
  v_user  uuid := private.find_user(p_query);
begin
  if v_user is null then
    raise exception 'Аккаунт не найден — проверь email или ID';
  end if;
  if v_user = v_owner then
    raise exception 'Роль владельца так не меняется';
  end if;
  delete from private.user_roles where user_id = v_user and role <> 'owner';
end;
$$;

-- Убрать тестового партнёра: аккаунт бота и всё, что к нему привязано (каскадом)
create or replace function public.dev_test_partner_remove()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_role();
  v_n   integer;
begin
  with gone as (
    delete from auth.users u
    where u.id in (select b.bot_id from private.test_bots b where b.owner_id = v_uid)
    returning 1
  )
  select count(*) into v_n from gone;
  return v_n;
end;
$$;

grant execute on function public.dev_remove_role(text) to authenticated;
grant execute on function public.dev_test_partner_remove() to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
revoke execute on function public.profiles_short_id() from public, anon, authenticated;
revoke execute on function public.bot_reply_nudge() from public, anon, authenticated;
revoke execute on function public.bot_reply_cast() from public, anon, authenticated;
revoke execute on function public.my_access() from public, anon;
revoke execute on function public.dev_set_role(text, text) from public, anon;
revoke execute on function public.dev_remove_role(text) from public, anon;
revoke execute on function public.dev_test_partner_create() from public, anon;
revoke execute on function public.dev_test_partner_remove() from public, anon;
revoke execute on function public.dev_test_partner_sleep(boolean) from public, anon;
select 'Шаг 6: функции удаления и права — готово' as "Готово";
