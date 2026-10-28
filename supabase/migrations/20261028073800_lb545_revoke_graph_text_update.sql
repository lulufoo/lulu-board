-- LB-545. Clients can no longer patch graph title or bmd.
-- update_owned_graph and save_shared_graph are security definer and still write those columns.
-- Select and delete stay.

revoke update (title, bmd) on table public.graphs from authenticated;
