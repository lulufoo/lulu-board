-- PAT storage and trusted verification in the existing Board database.
-- Plaintext never lands in a column. Management uses auth.uid(); reads hash the bearer.

create table if not exists public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  prefix text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint personal_access_tokens_name_len check (char_length(name) between 1 and 80),
  constraint personal_access_tokens_prefix check (prefix ~ '^lbp_[0-9a-f]{4}$'),
  constraint personal_access_tokens_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint personal_access_tokens_expires
    check (expires_at > created_at and expires_at <= created_at + interval '90 days')
);

create unique index if not exists personal_access_tokens_token_hash_key
  on public.personal_access_tokens (token_hash);
create index if not exists personal_access_tokens_user_created
  on public.personal_access_tokens (user_id, created_at desc);

alter table public.personal_access_tokens enable row level security;

revoke all on table public.personal_access_tokens from public;
revoke all on table public.personal_access_tokens from anon, authenticated;

create or replace function public.create_personal_access_token(
  p_name text,
  p_expires_in_days integer
)
returns table(id uuid, name text, prefix text, expires_at timestamptz, token text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_name text;
  v_secret text;
  v_token text;
  v_hash text;
  v_prefix text;
  v_expires timestamptz;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 90 then
    raise exception 'invalid expiry' using errcode = '22023';
  end if;
  v_expires := now() + make_interval(days => p_expires_in_days);

  loop
    v_secret := encode(extensions.gen_random_bytes(32), 'hex');
    v_token := 'lbp_' || v_secret;
    v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
    v_prefix := 'lbp_' || right(v_secret, 4);
    begin
      insert into public.personal_access_tokens (
        user_id, name, prefix, token_hash, expires_at
      ) values (
        v_uid, v_name, v_prefix, v_hash, v_expires
      )
      returning id, name, prefix, expires_at
      into id, name, prefix, expires_at;
      token := v_token;
      return next;
      return;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$function$;

create or replace function public.list_personal_access_tokens()
returns table(id uuid, name text, prefix text, expires_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  select t.id, t.name, t.prefix, t.expires_at, t.created_at
  from public.personal_access_tokens t
  where t.user_id = v_uid
    and t.revoked_at is null
  order by t.created_at desc;
end;
$function$;

create or replace function public.revoke_personal_access_token(p_id uuid)
returns table(id uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null then
    raise exception 'invalid token id' using errcode = '22023';
  end if;

  return query
  update public.personal_access_tokens as t
  set revoked_at = now()
  where t.id = p_id
    and t.user_id = v_uid
    and t.revoked_at is null
  returning t.id, t.revoked_at;

  if not found then
    raise exception 'token not found' using errcode = 'P0002';
  end if;
end;
$function$;

create or replace function public.read_owned_graph_with_pat(p_token text, p_graph_id text)
returns table(
  graph_id text,
  title text,
  bmd text,
  version integer,
  share_id text,
  created_at timestamptz,
  updated_at timestamptz,
  group_id text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_hash text;
begin
  if p_token is null or p_token !~ '^lbp_[0-9a-f]{64}$' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_graph_id is null or p_graph_id !~ '^b_[0-9a-f]{8}$' then
    raise exception 'invalid board id' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select t.user_id into v_uid
  from public.personal_access_tokens t
  where t.token_hash = v_hash
    and t.revoked_at is null
    and t.expires_at > now();
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  return query
  select r.graph_id, r.title, r.bmd, r.version, r.share_id,
         r.created_at, r.updated_at, r.group_id
  from public.graphs r
  where r.owner_id = v_uid
    and r.graph_id = p_graph_id;

  if not found then
    raise exception 'cloud board not found' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.create_personal_access_token(text, integer) from public, anon;
revoke all on function public.list_personal_access_tokens() from public, anon;
revoke all on function public.revoke_personal_access_token(uuid) from public, anon;
revoke all on function public.read_owned_graph_with_pat(text, text) from public;

grant execute on function public.create_personal_access_token(text, integer) to authenticated;
grant execute on function public.list_personal_access_tokens() to authenticated;
grant execute on function public.revoke_personal_access_token(uuid) to authenticated;
grant execute on function public.read_owned_graph_with_pat(text, text) to anon, authenticated;
