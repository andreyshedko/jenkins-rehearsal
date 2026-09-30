create table public.metadata_snapshot (
 id uuid primary key, target_jenkins_version text not null, generated_at timestamptz not null,
 source_generated_at timestamptz, status text not null check(status in ('active','retired')),
 normalized_json jsonb not null
);
create unique index one_active_snapshot on public.metadata_snapshot(status) where status='active';
-- Store the normalized catalog once, inside the snapshot. Views expose relational projections.
create view public.plugin_catalog with (security_invoker=true) as
 select s.id snapshot_id, p.key plugin_id, p.value->>'name' name, p.value->>'version' version,
 p.value->>'requiredCore' required_core,p.value->'dependencies' dependencies_json,
 (p.value->>'deprecated')::boolean deprecated,p.value->>'deprecationUrl' deprecation_url,
 (p.value->>'healthScore')::numeric health_score
 from public.metadata_snapshot s cross join lateral jsonb_each(s.normalized_json->'plugins') p;
create view public.security_warning with (security_invoker=true) as
 select s.id snapshot_id,w->>'pluginId' plugin_id,(w->>'core')::boolean core,w->>'id' warning_id,
 w->>'message' message,w->>'url' url,w->'ranges' affected_version_ranges_json
 from public.metadata_snapshot s cross join lateral jsonb_array_elements(s.normalized_json->'warnings') w;
create table public.scans (
 id uuid primary key,created_at timestamptz not null default now(),current_jenkins_version text not null,
 java_version integer,target_jenkins_version text not null,plugin_count integer not null,
 complexity text not null check(complexity in ('LOW','MEDIUM','HIGH','VERY HIGH')),
 blocker_count integer not null,warning_count integer not null,security_warning_count integer not null,
 java_migration_required boolean,plugin_count_bucket text not null,qualified_complex boolean not null,
 metadata_snapshot_id uuid not null references public.metadata_snapshot(id)
);
create table public.scan_findings (
 id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.scans(id) on delete cascade,
 category text not null,severity text not null,code text not null,data_json jsonb not null default '{}'
);
create table public.leads (
 id uuid primary key default gen_random_uuid(),scan_id uuid not null unique references public.scans(id) on delete cascade,
 email text not null,company text,controller_count integer,job_count_range text,plugin_count_range text,
 message text,stated_paid_interest boolean not null,created_at timestamptz not null default now()
);
create table public.events (
 id uuid primary key default gen_random_uuid(),scan_id uuid references public.scans(id) on delete cascade,
 name text not null check(name in ('scan_started','scan_completed','report_viewed','paid_rehearsal_cta_viewed','paid_rehearsal_cta_clicked','paid_rehearsal_interest_submitted')),
 data_json jsonb not null default '{}',created_at timestamptz not null default now()
);
create unique index event_once_per_scan on public.events(scan_id,name);
create index events_funnel on public.events(name,created_at);
create table public.rate_limits (key text primary key,window_start timestamptz not null,hits integer not null);

create function public.activate_snapshot(payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(739174);
 if jsonb_typeof(payload->'plugins') <> 'object' or payload->'plugins'='{}'::jsonb or payload->>'source'<>'jenkins' then raise exception 'Invalid snapshot'; end if;
 update metadata_snapshot set status='retired' where status='active';
 insert into metadata_snapshot values ((payload->>'id')::uuid,payload->>'targetJenkinsVersion',(payload->>'generatedAt')::timestamptz,(payload->>'sourceGeneratedAt')::timestamptz,'active',payload);
end $$;
create function public.take_rate_limit(bucket text,max_hits integer) returns boolean language plpgsql security invoker set search_path=public as $$
declare used integer;
begin
 insert into rate_limits values(bucket,date_trunc('minute',now()),1)
 on conflict(key) do update set window_start=date_trunc('minute',now()),hits=case when rate_limits.window_start=date_trunc('minute',now()) then rate_limits.hits+1 else 1 end returning hits into used;
 return used<=max_hits;
end $$;
create function public.persist_scan(payload jsonb,findings jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 insert into scans select * from jsonb_populate_record(null::scans,payload || jsonb_build_object('created_at',now()));
 insert into scan_findings(scan_id,category,severity,code,data_json)
 select (payload->>'id')::uuid,f->>'category',f->>'severity',f->>'code','{}'::jsonb from jsonb_array_elements(findings) f;
 insert into events(scan_id,name,data_json) values((payload->>'id')::uuid,'scan_completed',payload-'id'-'created_at'-'metadata_snapshot_id');
end $$;
create function public.record_interest(payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 insert into leads(scan_id,email,company,controller_count,job_count_range,plugin_count_range,message,stated_paid_interest)
 values((payload->>'scan_id')::uuid,payload->>'email',payload->>'company',(payload->>'controller_count')::integer,payload->>'job_count_range',payload->>'plugin_count_range',payload->>'message',(payload->>'stated_paid_interest')::boolean)
 on conflict(scan_id) do nothing;
 insert into events(scan_id,name,data_json) values((payload->>'scan_id')::uuid,'paid_rehearsal_interest_submitted',jsonb_build_object('stated_paid_interest',true,'controller_count',(payload->>'controller_count')::integer)) on conflict do nothing;
end $$;
-- No browser database access. Server service role alone can read/write these tables and functions.
alter table public.metadata_snapshot enable row level security;
alter table public.scans enable row level security;
alter table public.scan_findings enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;
alter table public.rate_limits enable row level security;
revoke all on table public.metadata_snapshot, public.plugin_catalog, public.security_warning, public.scans, public.scan_findings, public.leads, public.events, public.rate_limits from anon,authenticated;
revoke execute on function public.activate_snapshot(jsonb),public.take_rate_limit(text,integer),public.persist_scan(jsonb,jsonb),public.record_interest(jsonb) from public,anon,authenticated;
grant all on table public.metadata_snapshot, public.plugin_catalog, public.security_warning, public.scans, public.scan_findings, public.leads, public.events, public.rate_limits to service_role;
grant execute on function public.activate_snapshot(jsonb),public.take_rate_limit(text,integer),public.persist_scan(jsonb,jsonb),public.record_interest(jsonb) to service_role;
