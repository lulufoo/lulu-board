alter table public.groups
  add column updated_at timestamptz;

update public.groups g
set updated_at = coalesce((
  select max(r.updated_at)
  from public.graphs r
  where r.owner_id = g.owner_id and r.group_id = g.group_id
), g.created_at);

alter table public.groups
  alter column updated_at set not null,
  alter column updated_at set default now();

create index groups_owner_updated_idx
  on public.groups (owner_id, updated_at desc, group_id desc);

create function public.touch_group_updated_at()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE'
     and (old.owner_id is distinct from new.owner_id or old.group_id is distinct from new.group_id) then
    update public.groups g
    set updated_at = now()
    where g.owner_id = old.owner_id and g.group_id = old.group_id;
  end if;

  if tg_op = 'DELETE' then
    update public.groups g
    set updated_at = now()
    where g.owner_id = old.owner_id and g.group_id = old.group_id;
    return null;
  end if;

  update public.groups g
  set updated_at = new.updated_at
  where g.owner_id = new.owner_id and g.group_id = new.group_id;
  return null;
end;
$$;

create trigger graphs_touch_group_updated_at
  after insert or update or delete on public.graphs
  for each row execute function public.touch_group_updated_at();
