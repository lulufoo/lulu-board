-- LB-532. Creates one owned graph and its group, and stores search_text.
-- public.groups has no insert policy, so this function is security definer.
-- The owner is auth.uid() from the caller JWT.
-- p_search_text has no default. A blank value is stored as null.

create function public.create_owned_graph(
  p_graph_id text,
  p_title text,
  p_bmd text,
  p_search_text text,
  p_group_id text default null
)
returns table(
  graph_id text,
  title text,
  bmd text,
  version integer,
  share_id text,
  created_at timestamptz,
  updated_at timestamptz,
  group_id text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_group text;
  v_sort integer;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;
  if p_bmd is null then
    raise exception 'invalid board source' using errcode = '22023';
  end if;

  if p_group_id is null then
    loop
      v_group := 'g_' || encode(extensions.gen_random_bytes(4), 'hex');
      insert into public.groups (owner_id, group_id) values (v_uid, v_group)
      on conflict do nothing;
      exit when found;
    end loop;
  else
    if p_group_id !~ '^g_[0-9a-f]{8}$' then
      raise exception 'invalid group id' using errcode = '22023';
    end if;
    perform 1 from public.groups g
    where g.owner_id = v_uid and g.group_id = p_group_id
    for update;
    if not found then
      raise exception 'group not found' using errcode = 'P0002';
    end if;
    v_group := p_group_id;
  end if;

  v_sort := coalesce((
    select max(r.sort_order) from public.graphs r
    where r.owner_id = v_uid and r.group_id = v_group
  ), 0) + 1;

  insert into public.graphs (
    owner_id, graph_id, title, bmd, group_id, sort_order, search_text
  )
  values (
    v_uid,
    p_graph_id,
    coalesce(nullif(p_title, ''), 'Untitled'),
    p_bmd,
    v_group,
    v_sort,
    nullif(btrim(p_search_text), '')
  );

  return query
  select r.graph_id, r.title, r.bmd, r.version, r.share_id,
         r.created_at, r.updated_at, r.group_id
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;
end;
$$;

revoke all on function public.create_owned_graph(text, text, text, text, text) from public;
grant execute on function public.create_owned_graph(text, text, text, text, text) to anon, authenticated, service_role;
