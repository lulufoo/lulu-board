create extension if not exists pgcrypto with schema extensions;

alter table public.boards
  add column if not exists share_id text;

alter table public.boards
  drop constraint if exists boards_share_id_format;

alter table public.boards
  add constraint boards_share_id_format
  check (share_id is null or share_id ~ '^s_[0-9a-f]{32}$');

create unique index if not exists boards_share_id_key
  on public.boards (share_id);

create table if not exists public.grants (
  share_id text not null references public.boards (share_id) on delete cascade,
  principal text not null,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (share_id, principal),
  constraint grants_principal_format
    check (
      principal = 'all'
      or principal ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint grants_role_values
    check (role in ('view', 'edit'))
);

alter table public.grants enable row level security;

revoke all on table public.grants from public, anon, authenticated;

revoke update on table public.boards from authenticated;
grant update (title, bmd) on table public.boards to authenticated;
revoke insert on table public.boards from authenticated;
grant insert (owner_id, board_id, title, bmd) on table public.boards to authenticated;

create or replace function public.open_share(p_board_id text)
returns table(share_id text, version integer)
language plpgsql
security definer
set search_path = ''
as $$
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
  if p_board_id is null or p_board_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select b.share_id, b.version into v_existing, v_version
  from public.boards b
  where b.owner_id = v_uid and b.board_id = p_board_id;

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
      update public.boards b
      set share_id = v_share
      where b.owner_id = v_uid
        and b.board_id = p_board_id
        and b.share_id is null
      returning b.share_id, b.version into share_id, version;

      if found then
        insert into public.grants (share_id, principal, role)
        values (v_share, 'all', 'view');
        return next;
        return;
      end if;

      select b.share_id, b.version into share_id, version
      from public.boards b
      where b.owner_id = v_uid and b.board_id = p_board_id;
      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.rotate_share(p_board_id text)
returns table(share_id text, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_existing text;
  v_share text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_board_id is null or p_board_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select b.share_id into v_existing
  from public.boards b
  where b.owner_id = v_uid and b.board_id = p_board_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;
  if v_existing is null then
    raise exception 'board is not shared' using errcode = 'P0002';
  end if;

  delete from public.grants g where g.share_id = v_existing;

  loop
    v_share := 's_' || encode(extensions.gen_random_bytes(16), 'hex');
    begin
      update public.boards b
      set share_id = v_share
      where b.owner_id = v_uid and b.board_id = p_board_id
      returning b.share_id, b.version into share_id, version;
      insert into public.grants (share_id, principal, role)
      values (v_share, 'all', 'view');
      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.unshare(p_board_id text)
returns table(version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_existing text;
  v_version integer;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_board_id is null or p_board_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  select b.share_id, b.version into v_existing, v_version
  from public.boards b
  where b.owner_id = v_uid and b.board_id = p_board_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;

  if v_existing is null then
    version := v_version;
    return next;
    return;
  end if;

  delete from public.grants g where g.share_id = v_existing;

  update public.boards b
  set share_id = null
  where b.owner_id = v_uid and b.board_id = p_board_id
  returning b.version into version;

  return next;
end;
$$;

create or replace function public.get_shared_board(p_share_id text)
returns table(
  title text,
  bmd text,
  version integer,
  is_owner boolean,
  board_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_owner uuid;
  v_board text;
  v_title text;
  v_bmd text;
  v_version integer;
  v_allowed boolean;
begin
  if p_share_id is null or p_share_id !~ '^s_[0-9a-f]{32}$' then
    return;
  end if;

  v_uid := (select auth.uid());

  select b.owner_id, b.board_id, b.title, b.bmd, b.version
    into v_owner, v_board, v_title, v_bmd, v_version
  from public.boards b
  where b.share_id = p_share_id;

  if not found then
    return;
  end if;

  is_owner := v_uid is not null and v_uid = v_owner;
  v_allowed := is_owner
    or exists (
      select 1
      from public.grants g
      where g.share_id = p_share_id
        and g.principal = 'all'
        and g.role in ('view', 'edit')
    )
    or (
      v_uid is not null
      and exists (
        select 1
        from public.grants g
        where g.share_id = p_share_id
          and g.principal = v_uid::text
          and g.role in ('view', 'edit')
      )
    );

  if not v_allowed then
    return;
  end if;

  title := v_title;
  bmd := v_bmd;
  version := v_version;
  board_id := case when is_owner then v_board else null end;
  return next;
end;
$$;

revoke all on function public.open_share(text) from public, anon, authenticated;
revoke all on function public.rotate_share(text) from public, anon, authenticated;
revoke all on function public.unshare(text) from public, anon, authenticated;
revoke all on function public.get_shared_board(text) from public, anon, authenticated;

grant execute on function public.open_share(text) to authenticated;
grant execute on function public.rotate_share(text) to authenticated;
grant execute on function public.unshare(text) to authenticated;
grant execute on function public.get_shared_board(text) to anon, authenticated;
