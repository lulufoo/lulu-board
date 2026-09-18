revoke insert on table public.boards from authenticated;
grant insert (owner_id, board_id, title, bmd) on table public.boards to authenticated;
