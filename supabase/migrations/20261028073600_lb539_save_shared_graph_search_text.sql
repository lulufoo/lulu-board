-- LB-539. save_shared_graph stores search_text.
-- The five-argument function is the one the Worker calls.
-- The four-argument function stays for the current web caller and passes a null search text.
-- A blank p_bmd is rejected. Version mismatch updates nothing.

create function public.save_shared_graph(
  p_share_id text,
  p_title text,
  p_bmd text,
  p_search_text text,
  p_expected integer
)
returns table(
  title text,
  bmd text,
  version integer
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_allowed boolean;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_share_id is null or p_share_id !~ '^s_[0-9a-f]{32}$' then
    raise exception 'invalid share id' using errcode = '22023';
  end if;
  if p_bmd is null or btrim(p_bmd) = '' then
    raise exception 'invalid board source' using errcode = '22023';
  end if;
  if p_expected is null or p_expected < 1 then
    raise exception 'invalid version' using errcode = '22023';
  end if;

  v_allowed := exists (
    select 1
    from public.grants g
    where g.share_id = p_share_id
      and g.role = 'edit'
      and (g.principal = 'all' or g.principal = v_uid::text)
  );
  if not v_allowed then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  update public.graphs as r
  set
    title = coalesce(nullif(p_title, ''), r.title),
    bmd = p_bmd,
    search_text = nullif(btrim(p_search_text), '')
  where r.share_id = p_share_id
    and r.version = p_expected
  returning r.title, r.bmd, r.version;
end;
$$;

revoke all on function public.save_shared_graph(text, text, text, text, integer) from public;
grant execute on function public.save_shared_graph(text, text, text, text, integer) to anon, authenticated, service_role;

create or replace function public.save_shared_graph(
  p_share_id text,
  p_title text,
  p_bmd text,
  p_expected integer
)
returns table(
  title text,
  bmd text,
  version integer
)
language plpgsql
security definer
set search_path to ''
as $$
begin
  return query
  select *
  from public.save_shared_graph(p_share_id, p_title, p_bmd, null::text, p_expected);
end;
$$;
