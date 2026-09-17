create table public.boards (
  owner_id uuid not null references auth.users (id) on delete cascade,
  board_id text not null check (board_id ~ '^b_[0-9a-f]{8}$'),
  title text not null default 'Untitled',
  bmd text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, board_id)
);

create function public.set_boards_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boards_set_updated_at
before update on public.boards
for each row execute function public.set_boards_updated_at();

alter table public.boards enable row level security;

revoke all on table public.boards from anon;
grant select, insert, update, delete on table public.boards to authenticated;

create policy "boards_select_own"
on public.boards
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "boards_insert_own"
on public.boards
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "boards_update_own"
on public.boards
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "boards_delete_own"
on public.boards
for delete
to authenticated
using ((select auth.uid()) = owner_id);
