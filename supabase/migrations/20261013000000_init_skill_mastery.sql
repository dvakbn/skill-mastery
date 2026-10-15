-- Skill Mastery: schema for append-only attempts + versioned mutable documents.
-- Design: attempts are immutable (merge = union). Everything else the app shows
-- (SRS state, mastery, mistakes) is derived on-device by replaying attempts, so
-- two devices can never disagree about history. Mutable things (lesson progress,
-- settings, reflections, overrides) live in `docs` with optimistic versioning.

create table public.attempts (
  id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('quiz','exercise','review','card','assessment','roleplay','written','task','reflection')),
  context text not null default 'lesson',
  lesson_id text,
  item_id text,
  skill_id text,
  concept text,
  answer jsonb not null default '{}'::jsonb,
  score numeric not null check (score >= 0),
  max_score numeric not null default 1 check (max_score > 0),
  correct boolean,
  complete boolean not null default true,
  duration_ms integer,
  client_ts timestamptz not null,
  device_id text,
  server_seq bigint generated always as identity,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index attempts_user_seq_idx on public.attempts (user_id, server_seq);
create index attempts_user_skill_idx on public.attempts (user_id, skill_id, client_ts);

create sequence public.docs_server_seq;
create table public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  key text not null,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null,
  deleted boolean not null default false,
  device_id text,
  server_seq bigint not null default nextval('public.docs_server_seq'),
  primary key (user_id, kind, key)
);
create index docs_user_seq_idx on public.docs (user_id, server_seq);

alter table public.attempts enable row level security;
alter table public.docs enable row level security;

create policy attempts_select on public.attempts for select to authenticated using (user_id = (select auth.uid()));
create policy attempts_insert on public.attempts for insert to authenticated with check (user_id = (select auth.uid()));
create policy attempts_delete on public.attempts for delete to authenticated using (user_id = (select auth.uid()));
create policy docs_select on public.docs for select to authenticated using (user_id = (select auth.uid()));
create policy docs_insert on public.docs for insert to authenticated with check (user_id = (select auth.uid()));
create policy docs_update on public.docs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy docs_delete on public.docs for delete to authenticated using (user_id = (select auth.uid()));

-- One round trip push. Attempts: idempotent insert. Docs: optimistic concurrency.
-- p_docs element: {kind,key,data,base_version,updated_at,deleted,device_id}; base_version 0 = new.
create or replace function public.push_changes(p_attempts jsonb default '[]'::jsonb, p_docs jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  d jsonb;
  cur public.docs%rowtype;
  n_att int := 0;
  accepted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  newv int;
  seq bigint;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  with ins as (
    insert into public.attempts (id, user_id, kind, context, lesson_id, item_id, skill_id, concept, answer, score, max_score, correct, complete, duration_ms, client_ts, device_id)
    select (a->>'id')::uuid, uid, a->>'kind', coalesce(a->>'context','lesson'), a->>'lesson_id', a->>'item_id', a->>'skill_id', a->>'concept',
           coalesce(a->'answer','{}'::jsonb), (a->>'score')::numeric, coalesce((a->>'max_score')::numeric,1),
           (a->>'correct')::boolean, coalesce((a->>'complete')::boolean,true), (a->>'duration_ms')::int, (a->>'client_ts')::timestamptz, a->>'device_id'
    from jsonb_array_elements(coalesce(p_attempts,'[]'::jsonb)) a
    on conflict (user_id, id) do nothing
    returning 1
  ) select count(*) into n_att from ins;

  for d in select * from jsonb_array_elements(coalesce(p_docs,'[]'::jsonb)) loop
    select * into cur from public.docs where user_id = uid and kind = d->>'kind' and key = d->>'key' for update;
    if not found then
      if coalesce((d->>'base_version')::int,0) <> 0 then
        -- client believes it exists (e.g. server was reset): treat as new insert
        null;
      end if;
      insert into public.docs (user_id, kind, key, data, version, updated_at, deleted, device_id)
      values (uid, d->>'kind', d->>'key', coalesce(d->'data','{}'::jsonb), 1, (d->>'updated_at')::timestamptz, coalesce((d->>'deleted')::boolean,false), d->>'device_id')
      returning version, server_seq into newv, seq;
      accepted := accepted || jsonb_build_object('kind', d->>'kind', 'key', d->>'key', 'version', newv, 'server_seq', seq);
    elsif cur.version = coalesce((d->>'base_version')::int,0) then
      update public.docs set data = coalesce(d->'data','{}'::jsonb), version = cur.version + 1, updated_at = (d->>'updated_at')::timestamptz,
             deleted = coalesce((d->>'deleted')::boolean,false), device_id = d->>'device_id', server_seq = nextval('public.docs_server_seq')
      where user_id = uid and kind = cur.kind and key = cur.key
      returning version, server_seq into newv, seq;
      accepted := accepted || jsonb_build_object('kind', cur.kind, 'key', cur.key, 'version', newv, 'server_seq', seq);
    else
      conflicts := conflicts || jsonb_build_object('kind', cur.kind, 'key', cur.key, 'data', cur.data, 'version', cur.version,
                   'updated_at', cur.updated_at, 'deleted', cur.deleted, 'device_id', cur.device_id, 'server_seq', cur.server_seq);
    end if;
  end loop;

  return jsonb_build_object('attempts_inserted', n_att, 'accepted', accepted, 'conflicts', conflicts);
end;
$$;

-- Wipe the signed-in user's learning data (used by "reset account data").
create or replace function public.reset_my_data()
returns void language sql security invoker set search_path = public as $$
  delete from public.attempts where user_id = (select auth.uid());
  delete from public.docs where user_id = (select auth.uid());
$$;

revoke all on function public.push_changes(jsonb, jsonb) from public, anon;
revoke all on function public.reset_my_data() from public, anon;
grant execute on function public.push_changes(jsonb, jsonb) to authenticated;
grant execute on function public.reset_my_data() to authenticated;
