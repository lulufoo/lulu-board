alter table public.boards
  add column if not exists version integer not null default 1;

create or replace function public.set_boards_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.version = coalesce(old.version, 1) + 1;
  return new;
end;
$$;
