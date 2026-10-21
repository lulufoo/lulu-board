-- L4 cloud row: public.boards.board_id → public.graphs.graph_id
-- Row id values stay b_[0-9a-f]{8}. share_id / group_id / bmd stay.

drop trigger if exists boards_set_updated_at on public.boards;
drop trigger if exists boards_delete_empty_group on public.boards;

alter table public.boards rename to graphs;
alter table public.graphs rename column board_id to graph_id;

alter table public.graphs rename constraint boards_pkey to graphs_pkey;
alter table public.graphs rename constraint boards_board_id_check to graphs_graph_id_check;
alter table public.graphs rename constraint boards_group_id_check to graphs_group_id_check;
alter table public.graphs rename constraint boards_share_id_format to graphs_share_id_format;
alter table public.graphs rename constraint boards_group_fkey to graphs_group_fkey;
alter table public.graphs rename constraint boards_owner_id_fkey to graphs_owner_id_fkey;

alter index public.boards_share_id_key rename to graphs_share_id_key;
alter index public.boards_owner_group_sort_idx rename to graphs_owner_group_sort_idx;

alter policy boards_delete_own on public.graphs rename to graphs_delete_own;
alter policy boards_insert_own on public.graphs rename to graphs_insert_own;
alter policy boards_select_own on public.graphs rename to graphs_select_own;
alter policy boards_update_own on public.graphs rename to graphs_update_own;

drop function if exists public.set_boards_updated_at();
drop function if exists public.delete_empty_group_after_board_delete();

create function public.set_graphs_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at = now();
  new.version = coalesce(old.version, 1) + 1;
  return new;
end;
$function$;

create function public.delete_empty_group_after_graph_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  delete from public.groups g
  where g.owner_id = old.owner_id and g.group_id = old.group_id
    and not exists (
      select 1 from public.graphs r
      where r.owner_id = old.owner_id and r.group_id = old.group_id
    );
  return null;
end;
$function$;

create trigger graphs_set_updated_at
  before update on public.graphs
  for each row
  execute function public.set_graphs_updated_at();

create trigger graphs_delete_empty_group
  after delete on public.graphs
  for each row
  execute function public.delete_empty_group_after_graph_delete();

grant execute on function public.set_graphs_updated_at() to anon, authenticated, service_role;

drop function if exists public.create_owned_board_with_group(text, text, text, text);
drop function if exists public.get_shared_board(text);
drop function if exists public.save_shared_board(text, text, text, integer);
drop function if exists public.search_boards(text);
drop function if exists public.reorder_group_boards(text, text[]);
drop function if exists public.open_share(text);
drop function if exists public.own_share_state(text);
drop function if exists public.rotate_share(text);
drop function if exists public.unshare(text);
drop function if exists public.set_share_role(text, text, text);

create function public.create_owned_graph_with_group(
  p_graph_id text,
  p_title text,
  p_bmd text,
  p_group_id text default null
)
returns table(
  graph_id text,
  title text,
  bmd text,
  version integer,
  share_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  group_id text
)
language plpgsql
security definer
set search_path to ''
as $function$
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

  insert into public.graphs (owner_id, graph_id, title, bmd, group_id, sort_order)
  values (v_uid, p_graph_id, coalesce(nullif(p_title, ''), 'Untitled'), p_bmd, v_group, v_sort);

  return query
  select r.graph_id, r.title, r.bmd, r.version, r.share_id,
         r.created_at, r.updated_at, r.group_id
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;
end;
$function$;

create function public.get_shared_graph(p_share_id text)
returns table(
  title text,
  bmd text,
  version integer,
  is_owner boolean,
  graph_id text,
  access text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_owner uuid;
  v_graph text;
  v_title text;
  v_bmd text;
  v_version integer;
  v_allowed boolean;
  v_access text;
  v_user_role text;
begin
  if p_share_id is null or p_share_id !~ '^s_[0-9a-f]{32}$' then
    return;
  end if;

  v_uid := (select auth.uid());

  select r.owner_id, r.graph_id, r.title, r.bmd, r.version
    into v_owner, v_graph, v_title, v_bmd, v_version
  from public.graphs r
  where r.share_id = p_share_id;

  if not found then
    return;
  end if;

  is_owner := v_uid is not null and v_uid = v_owner;
  select g.role into v_access
  from public.grants g
  where g.share_id = p_share_id and g.principal = 'all';
  if v_uid is not null then
    select g.role into v_user_role
    from public.grants g
    where g.share_id = p_share_id and g.principal = v_uid::text;
    if v_user_role = 'edit' then
      v_access := 'edit';
    elsif v_access is null then
      v_access := v_user_role;
    end if;
  end if;

  if v_access is null then
    select g.role into v_access
    from public.grants g
    where g.share_id = p_share_id and g.principal = 'public';
  end if;

  v_allowed := is_owner
    or v_access in ('view', 'edit');

  if not v_allowed then
    return;
  end if;

  title := v_title;
  bmd := v_bmd;
  version := v_version;
  graph_id := case when is_owner then v_graph else null end;
  access := case when is_owner then 'edit' else coalesce(v_access, 'view') end;
  return next;
end;
$function$;

create function public.save_shared_graph(
  p_share_id text,
  p_title text,
  p_bmd text,
  p_expected integer
)
returns table(title text, bmd text, version integer)
language plpgsql
security definer
set search_path to ''
as $function$
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
  if p_bmd is null then
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

  update public.graphs r
  set
    title = coalesce(nullif(p_title, ''), r.title),
    bmd = p_bmd
  where r.share_id = p_share_id
    and r.version = p_expected
  returning r.title, r.bmd, r.version into title, bmd, version;

  if not found then
    return;
  end if;
  return next;
end;
$function$;

create function public.search_graphs(p_query text)
returns table(category text, title text, share_id text, graph_id text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_q text;
  v_pat text;
  v_bs text := chr(92);
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  v_q := trim(both from coalesce(p_query, ''));
  if v_q = '' then
    return;
  end if;

  v_pat := '%' || replace(replace(replace(v_q, v_bs, v_bs || v_bs), '%', v_bs || '%'), '_', v_bs || '_') || '%';

  return query
  select
    'mine'::text,
    r.title,
    r.share_id,
    r.graph_id
  from public.graphs r
  where r.owner_id = v_uid
    and (r.title ilike v_pat escape v_bs or r.bmd ilike v_pat escape v_bs)
  order by r.updated_at desc
  limit 20;

  return query
  select
    'public'::text,
    r.title,
    r.share_id,
    null::text
  from public.grants g
  join public.graphs r on r.share_id = g.share_id
  where g.principal = 'public'
    and r.owner_id is distinct from v_uid
    and (r.title ilike v_pat escape v_bs or r.bmd ilike v_pat escape v_bs)
  order by r.updated_at desc
  limit 20;
end;
$function$;

create function public.reorder_group_graphs(p_group_id text, p_graph_ids text[])
returns table(graph_id text, sort_order integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_members integer;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_group_id is null or p_group_id !~ '^g_[0-9a-f]{8}$' then
    raise exception 'invalid group id' using errcode = '22023';
  end if;

  perform 1 from public.groups g
  where g.owner_id = v_uid and g.group_id = p_group_id
  for update;
  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  select count(*) into v_members
  from public.graphs r
  where r.owner_id = v_uid and r.group_id = p_group_id;
  if v_members = 0 then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  if p_graph_ids is null
     or cardinality(p_graph_ids) <> v_members
     or (select count(distinct x) from unnest(p_graph_ids) x) <> v_members
     or exists (
       select 1 from unnest(p_graph_ids) x
       where not exists (
         select 1 from public.graphs r
         where r.owner_id = v_uid and r.group_id = p_group_id and r.graph_id = x))
  then
    raise exception 'board list must match the group members' using errcode = '22023';
  end if;

  update public.graphs r
  set sort_order = t.ord
  from unnest(p_graph_ids) with ordinality as t(id, ord)
  where r.owner_id = v_uid and r.group_id = p_group_id and r.graph_id = t.id
    and r.sort_order is distinct from t.ord;

  return query
  select r.graph_id, r.sort_order
  from public.graphs r
  where r.owner_id = v_uid and r.group_id = p_group_id
  order by r.sort_order, r.graph_id;
end;
$function$;

create function public.open_share(p_graph_id text)
returns table(share_id text, version integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_existing text;
  v_version integer;
  v_share text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select r.share_id, r.version into v_existing, v_version
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;

  if v_existing is not null then
    share_id := v_existing;
    version := v_version;
    return next;
    return;
  end if;

  loop
    v_share := 's_' || encode(extensions.gen_random_bytes(16), 'hex');
    begin
      update public.graphs r
      set share_id = v_share
      where r.owner_id = v_uid
        and r.graph_id = p_graph_id
        and r.share_id is null
      returning r.share_id, r.version into share_id, version;

      if found then
        insert into public.grants (share_id, principal, role)
        values (v_share, 'all', 'view');
        return next;
        return;
      end if;

      select r.share_id, r.version into share_id, version
      from public.graphs r
      where r.owner_id = v_uid and r.graph_id = p_graph_id;
      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$function$;

create function public.own_share_state(p_graph_id text)
returns table(share_id text, role text, version integer, is_public boolean)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_existing text;
  v_version integer;
  v_role text;
  v_is_public boolean := false;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select r.share_id, r.version into v_existing, v_version
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;

  if v_existing is not null then
    select g.role into v_role
    from public.grants g
    where g.share_id = v_existing and g.principal = 'all';
    v_is_public := exists (
      select 1 from public.grants g
      where g.share_id = v_existing and g.principal = 'public'
    );
  end if;

  share_id := v_existing;
  role := coalesce(v_role, 'view');
  version := v_version;
  is_public := v_is_public;
  return next;
end;
$function$;

create function public.rotate_share(p_graph_id text)
returns table(share_id text, version integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_existing text;
  v_role text;
  v_public boolean;
  v_share text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select r.share_id into v_existing
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;
  if v_existing is null then
    raise exception 'board is not shared' using errcode = 'P0002';
  end if;

  select g.role into v_role
  from public.grants g
  where g.share_id = v_existing and g.principal = 'all';
  if v_role is null then
    v_role := 'view';
  end if;

  v_public := exists (
    select 1 from public.grants g
    where g.share_id = v_existing and g.principal = 'public'
  );

  delete from public.grants g where g.share_id = v_existing;

  loop
    v_share := 's_' || encode(extensions.gen_random_bytes(16), 'hex');
    begin
      update public.graphs r
      set share_id = v_share
      where r.owner_id = v_uid and r.graph_id = p_graph_id
      returning r.share_id, r.version into share_id, version;
      insert into public.grants (share_id, principal, role)
      values (v_share, 'all', v_role);
      if v_public then
        insert into public.grants (share_id, principal, role)
        values (v_share, 'public', 'view');
      end if;
      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$function$;

create function public.unshare(p_graph_id text)
returns table(version integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_existing text;
  v_version integer;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select r.share_id, r.version into v_existing, v_version
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;

  if v_existing is null then
    version := v_version;
    return next;
    return;
  end if;

  delete from public.grants g where g.share_id = v_existing;

  update public.graphs r
  set share_id = null
  where r.owner_id = v_uid and r.graph_id = p_graph_id
  returning r.version into version;

  return next;
end;
$function$;

create function public.set_share_role(
  p_graph_id text,
  p_role text,
  p_principal text default 'all'
)
returns table(share_id text, version integer, role text, is_public boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_existing text;
  v_version integer;
  v_principal text;
  v_all_role text;
  v_is_public boolean;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  v_principal := coalesce(nullif(p_principal, ''), 'all');
  if v_principal not in ('all', 'public') then
    raise exception 'invalid share principal' using errcode = '22023';
  end if;

  if v_principal = 'all' then
    if p_role is null or p_role not in ('view', 'edit') then
      raise exception 'invalid share role' using errcode = '22023';
    end if;
  else
    if p_role is null or p_role not in ('view', 'off') then
      raise exception 'invalid share role' using errcode = '22023';
    end if;
  end if;

  select r.share_id, r.version into v_existing, v_version
  from public.graphs r
  where r.owner_id = v_uid and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;

  if v_existing is null then
    select o.share_id, o.version
      into v_existing, v_version
    from public.open_share(p_graph_id) as o(share_id, version);
  end if;

  if v_principal = 'all' then
    if p_role = 'edit' and exists (
      select 1 from public.grants g
      where g.share_id = v_existing and g.principal = 'public'
    ) then
      raise exception 'Turn off Public before allowing link edits.' using errcode = '22023';
    end if;

    update public.grants g
    set role = p_role
    where g.share_id = v_existing and g.principal = 'all';

    if not found then
      insert into public.grants (share_id, principal, role)
      values (v_existing, 'all', p_role);
    end if;
  elsif p_role = 'view' then
    select g.role into v_all_role
    from public.grants g
    where g.share_id = v_existing and g.principal = 'all';
    if v_all_role = 'edit' then
      raise exception 'Turn link access to View before listing this board in search.' using errcode = '22023';
    end if;

    insert into public.grants (share_id, principal, role)
    values (v_existing, 'public', 'view')
    on conflict on constraint grants_pkey do nothing;
  else
    delete from public.grants g
    where g.share_id = v_existing and g.principal = 'public';
  end if;

  select g.role into v_all_role
  from public.grants g
  where g.share_id = v_existing and g.principal = 'all';
  v_is_public := exists (
    select 1 from public.grants g
    where g.share_id = v_existing and g.principal = 'public'
  );

  share_id := v_existing;
  version := v_version;
  role := coalesce(v_all_role, 'view');
  is_public := v_is_public;
  return next;
end;
$function$;

revoke all on function public.create_owned_graph_with_group(text, text, text, text) from public;
revoke all on function public.get_shared_graph(text) from public;
revoke all on function public.save_shared_graph(text, text, text, integer) from public;
revoke all on function public.search_graphs(text) from public;
revoke all on function public.reorder_group_graphs(text, text[]) from public;
revoke all on function public.open_share(text) from public;
revoke all on function public.own_share_state(text) from public;
revoke all on function public.rotate_share(text) from public;
revoke all on function public.unshare(text) from public;
revoke all on function public.set_share_role(text, text, text) from public;

grant execute on function public.create_owned_graph_with_group(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_shared_graph(text) to anon, authenticated, service_role;
grant execute on function public.save_shared_graph(text, text, text, integer) to authenticated, service_role;
grant execute on function public.search_graphs(text) to anon, authenticated, service_role;
grant execute on function public.reorder_group_graphs(text, text[]) to authenticated, service_role;
grant execute on function public.open_share(text) to authenticated, service_role;
grant execute on function public.own_share_state(text) to anon, authenticated, service_role;
grant execute on function public.rotate_share(text) to authenticated, service_role;
grant execute on function public.unshare(text) to authenticated, service_role;
grant execute on function public.set_share_role(text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
