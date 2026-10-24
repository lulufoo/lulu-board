create function public.load_group_shells(p_graph_id text, p_group_id text default null)
returns table(graph_id text, group_id text, title text, sort_order integer)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_group text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select r.group_id into v_group
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;
  if not found then
    raise exception 'board not found' using errcode = 'P0002';
  end if;

  -- p_group_id is accepted from the caller. Membership follows the graph row.

  return query
  select r.graph_id, r.group_id, r.title, r.sort_order
  from public.graphs r
  where r.owner_id = v_uid and r.group_id = v_group
  order by r.sort_order, r.graph_id;
end;
$$;

revoke all on function public.load_group_shells(text, text) from public;
grant execute on function public.load_group_shells(text, text) to anon, authenticated;
