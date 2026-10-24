create table if not exists public.short_links (
  id text primary key,
  bmd text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint short_links_id_format check (id ~ '^p_[0-9a-f]{64}$'),
  constraint short_links_ttl check (expires_at = created_at + interval '30 minutes')
);

create function public.short_links_set_expiry()
returns trigger
language plpgsql
as $$
begin
  new.expires_at := new.created_at + interval '30 minutes';
  return new;
end;
$$;

create trigger short_links_set_expiry
before insert on public.short_links
for each row
execute function public.short_links_set_expiry();

alter table public.short_links enable row level security;

revoke all on table public.short_links from anon, authenticated, public;
revoke all on function public.short_links_set_expiry() from public, anon, authenticated;
