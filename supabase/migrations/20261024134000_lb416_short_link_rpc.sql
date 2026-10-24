create function public.create_short_link(p_bmd text)
returns table(url text, id text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id text;
begin
  if p_bmd is null or length(trim(p_bmd)) = 0 then
    raise exception 'invalid board source' using errcode = '22023';
  end if;

  loop
    v_id := 'p_' || encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.short_links (id, bmd) values (v_id, p_bmd)
    on conflict do nothing;
    exit when found;
  end loop;

  url := 'https://luluboard.app/#p:' || v_id;
  id := v_id;
  return next;
end;
$$;

create function public.get_short_link(p_id text)
returns table(bmd text)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if p_id is null or p_id !~ '^p_[0-9a-f]{64}$' then
    raise exception 'invalid short link id' using errcode = '22023';
  end if;

  return query
  select r.bmd
  from public.short_links r
  where r.id = p_id
    and r.expires_at > now();

  if not found then
    raise exception 'short link not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_short_link(text) from public;
revoke all on function public.get_short_link(text) from public;
grant execute on function public.create_short_link(text) to anon, authenticated;
grant execute on function public.get_short_link(text) to anon, authenticated;
