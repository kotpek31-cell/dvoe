-- Этап фиксации 0.2: места с повторами в мини-играх комнаты (общее место, ничья).
-- Идемпотентно (create or replace). То же самое — в schema.sql, раздел 12.
create or replace function public.room_game_finish(p_game uuid, p_result jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_g       public.room_games;
  v_min     integer;
  v_places  text[];
  v_ids     text[];
  v_winners uuid[];
  v_ranks   jsonb := p_result -> 'ranks';
  v_counted boolean;
  v_p       jsonb;
  v_u       uuid;
  v_val     real;
  v_old     real;
  v_new     boolean;
  v_records jsonb := '[]'::jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_total   integer;
  v_item    text;
begin
  select * into v_g from public.room_games where id = p_game for update;
  if v_g.id is null or v_g.host <> v_uid then
    raise exception 'Итог присылает тот, кто крутил колесо';
  end if;
  if v_g.finished_at is not null then
    return jsonb_build_object('ok', false, 'error', 'finished', 'message', 'Игра уже закончилась');
  end if;
  v_min := case v_g.game when 'stars' then 30 when 'pumpkin' then 10 when 'reaction' then 10 else 6 end;
  if now() < v_g.started_at + make_interval(secs => v_min) then
    return jsonb_build_object('ok', false, 'error', 'too_fast', 'message', 'Слишком быстро для этой игры');
  end if;

  v_places := array(select jsonb_array_elements_text(coalesce(p_result -> 'places', '[]'::jsonb)));
  v_ids := array(select e ->> 'm' from jsonb_array_elements(v_g.players) e);
  if cardinality(v_places) <> cardinality(v_ids)
     or cardinality(array(select distinct unnest(v_places))) <> cardinality(v_ids)
     or not (v_places <@ v_ids) then
    return jsonb_build_object('ok', false, 'error', 'result', 'message', 'Итог не сходится с игроками');
  end if;
  -- Места с повторами (этап фиксации 0.2): одинаковый результат — общее место. Победа — всем на первом месте;
  -- все на первом (ничья) — никому. Без ranks (старые версии) — победил первый в списке.
  if jsonb_typeof(v_ranks) = 'object' then
    if exists (select 1 from unnest(v_ids) m
               where not coalesce(case when jsonb_typeof(v_ranks -> m) = 'number'
                                       then (v_ranks ->> m)::numeric between 1 and cardinality(v_ids) end, false)) then
      return jsonb_build_object('ok', false, 'error', 'result', 'message', 'Итог не сходится с игроками');
    end if;
    v_winners := array(select m::uuid from unnest(v_ids) m where (v_ranks ->> m)::numeric = 1);
    if cardinality(v_winners) = cardinality(v_ids) then
      v_winners := '{}';
    end if;
  else
    v_winners := array[v_places[1]::uuid];
  end if;
  v_counted := v_g.humans >= 2 and now() < v_g.started_at + interval '20 minutes';
  update public.room_games set finished_at = now(), result = p_result where id = p_game;

  if v_counted then
    for v_p in select * from jsonb_array_elements(v_g.players) loop
      continue when v_p ->> 'u' is null;
      v_u := (v_p ->> 'u')::uuid;
      v_val := case when jsonb_typeof(p_result -> 'best' -> (v_p ->> 'm')) = 'number'
                    then (p_result -> 'best' ->> (v_p ->> 'm'))::real end;
      if v_g.game = 'stars' and not (v_val between 0 and 300) then v_val := null; end if;
      if v_g.game = 'reaction' and not (v_val between 80 and 5000) then v_val := null; end if;
      if v_g.game in ('pumpkin', 'rps') then v_val := null; end if;
      select g.best into v_old from public.game_records g where g.user_id = v_u and g.game = v_g.game;
      v_new := v_val is not null and (v_old is null
                                      or (v_g.game = 'stars' and v_val > v_old)
                                      or (v_g.game = 'reaction' and v_val < v_old));
      insert into public.game_records as r (user_id, game, played, wins, best, best_at)
      values (v_u, v_g.game, 1, case when (v_p ->> 'm')::uuid = any(v_winners) then 1 else 0 end,
              v_val, case when v_val is not null then now() end)
      on conflict (user_id, game) do update
        set played = r.played + 1,
            wins = r.wins + excluded.wins,
            best = case when v_new then excluded.best else r.best end,
            best_at = case when v_new then now() else r.best_at end,
            updated_at = now();
      if v_new then
        v_records := v_records || jsonb_build_object('user_id', v_u, 'member', v_p ->> 'm', 'best', v_val);
      end if;
      -- награды за победы: 1 — кубок, 10 — корона, 25 — плащ
      if (v_p ->> 'm')::uuid = any(v_winners) then
        select coalesce(sum(g.wins), 0) into v_total from public.game_records g where g.user_id = v_u;
        foreach v_item in array array['hand.trophy', 'hat.champion', 'back.champion'] loop
          continue when v_total < case v_item when 'hand.trophy' then 1 when 'hat.champion' then 10 else 25 end;
          continue when not exists (select 1 from public.items i where i.id = v_item);
          insert into public.inventory (user_id, item_id, source) values (v_u, v_item, 'game')
          on conflict (user_id, item_id) do nothing;
          if found then
            v_rewards := v_rewards || jsonb_build_object('user_id', v_u, 'item_id', v_item);
          end if;
        end loop;
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'counted', v_counted, 'winner', v_winners[1], 'winners', to_jsonb(v_winners),
                            'draw', cardinality(v_winners) = 0, 'records', v_records, 'rewards', v_rewards);
end;
$$;
