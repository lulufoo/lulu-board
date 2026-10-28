-- LB-538. Updates one owned graph and stores search_text.
-- The owner is auth.uid() from the caller JWT.
-- p_search_text has no default. A blank value is stored as null.
-- A blank p_bmd is rejected. Version mismatch updates nothing.
-- graphs_set_updated_at advances version. This function does not set it.

create function public.update_owned_graph(
  p_graph_id text,
  p_title text,
  p_bmd text,
  p_search_text text,
  p_expected integer
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
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;
  if p_bmd is null or btrim(p_bmd) = '' then
    raise exception 'invalid board source' using errcode = '22023';
  end if;
  if p_expected is null or p_expected < 1 then
    raise exception 'invalid version' using errcode = '22023';
  end if;

  return query
  update public.graphs as r
  set
    title = coalesce(nullif(p_title, ''), 'Untitled'),
    bmd = p_bmd,
    search_text = nullif(btrim(p_search_text), '')
  where r.owner_id = v_uid
    and r.graph_id = p_graph_id
    and r.version = p_expected
  returning r.graph_id, r.title, r.bmd, r.version, r.share_id,
            r.created_at, r.updated_at, r.group_id;
end;
$$;

revoke all on function public.update_owned_graph(text, text, text, text, integer) from public;
grant execute on function public.update_owned_graph(text, text, text, text, integer) to anon, authenticated, service_role;
