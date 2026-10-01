-- =====================================================================
--  «Двое» 0.2 — завершение применения (один раз, через SQL Editor).
--  Коннектор Claude не может выполнить эти команды без подтверждения
--  (revoke / delete внутри функций), поэтому они вынесены сюда.
--  То же самое уже есть в schema.sql (раздел 10) — файл можно запускать повторно.
-- =====================================================================

-- Две функции комнаты разработчиков
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

-- Таблицы 0.2: клиентам — только чтение (RLS уже включён)
revoke all on public.items, public.inventory, public.locations, public.pair_locations, public.ability_casts
  from anon, authenticated;
grant select on public.items, public.inventory, public.locations, public.pair_locations, public.ability_casts
  to authenticated;

-- Функции: без входа — ничего; служебные — никому
revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function public.profiles_chibi_guard() from public, anon, authenticated;
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

grant execute on function public.dev_revoke_item(uuid, text) to authenticated;
grant execute on function public.dev_set_developer(text, boolean) to authenticated;

select 'Двое 0.2: готово' as "Готово";
