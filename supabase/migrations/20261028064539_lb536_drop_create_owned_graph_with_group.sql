-- LB-536. Drops the old create function. Create goes through create_owned_graph.
-- The live database no longer has this function, and the repo never created it.
-- IF EXISTS lets the migration apply in both places.

drop function if exists public.create_owned_graph_with_group(text, text, text, text);
