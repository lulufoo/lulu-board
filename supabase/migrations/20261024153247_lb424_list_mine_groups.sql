create function public.list_mine_groups(p_before timestamptz default null, p_before_group_id text default null)
returns table(
  total integer,
  group_id text,
  group_updated_at timestamptz,
  face_graph_id text,
  face_title text,
  graph_id text,
  title text,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if (p_before is null) <> (p_before_group_id is null) then
    raise exception 'invalid page cursor' using errcode = '22023';
  end if;

  return query
  with owned as (
    select g.group_id, g.updated_at
    from public.groups g
    where g.owner_id = v_uid
      and exists (
        select 1 from public.graphs r
        where r.owner_id = g.owner_id and r.group_id = g.group_id
      )
  ),
  page as (
    select o.group_id, o.updated_at
    from owned o
    where p_before is null
       or o.updated_at < p_before
       or (o.updated_at = p_before and o.group_id < p_before_group_id)
    order by o.updated_at desc, o.group_id desc
    limit 20
  ),
  face as (
    select distinct on (r.group_id)
      r.group_id,
      r.graph_id as face_graph_id,
      r.title as face_title
    from public.graphs r
    join page p on p.group_id = r.group_id
    where r.owner_id = v_uid
    order by r.group_id, r.updated_at desc, r.graph_id desc
  )
  select
    (select count(*)::integer from owned),
    p.group_id,
    p.updated_at,
    f.face_graph_id,
    f.face_title,
    r.graph_id,
    r.title,
    r.sort_order
  from page p
  join face f on f.group_id = p.group_id
  join public.graphs r
    on r.owner_id = v_uid and r.group_id = p.group_id
  order by p.updated_at desc, p.group_id desc, r.sort_order, r.graph_id;
end;
$$;

revoke all on function public.list_mine_groups(timestamptz, text) from public;
grant execute on function public.list_mine_groups(timestamptz, text) to anon, authenticated;
