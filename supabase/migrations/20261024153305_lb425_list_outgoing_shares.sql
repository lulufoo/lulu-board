create function public.list_outgoing_shares()
returns table(
  total integer,
  graph_id text,
  title text,
  share_id text,
  role text,
  is_public boolean,
  updated_at timestamptz
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

  return query
  with shared as (
    select r.graph_id, r.title, r.share_id, r.updated_at
    from public.graphs r
    where r.owner_id = v_uid and r.share_id is not null
  )
  select
    (select count(*)::integer from shared),
    s.graph_id,
    s.title,
    s.share_id,
    coalesce(a.role, 'view'::text),
    exists (
      select 1 from public.grants g
      where g.share_id = s.share_id and g.principal = 'public'
    ),
    s.updated_at
  from shared s
  left join public.grants a
    on a.share_id = s.share_id and a.principal = 'all'
  order by s.updated_at desc, s.graph_id desc;
end;
$$;

revoke all on function public.list_outgoing_shares() from public;
grant execute on function public.list_outgoing_shares() to anon, authenticated;
