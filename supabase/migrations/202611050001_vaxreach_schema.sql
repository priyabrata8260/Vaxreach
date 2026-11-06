-- VaxReach demo schema. The five-dose schedule is an explicitly simplified
-- prototype schedule, not clinical guidance. No child records are seeded.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'VaxReach user',
  role text not null default 'health_worker' check (role in ('admin', 'health_worker', 'asha_worker')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'VaxReach user'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_vaxreach_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create table public.localities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table public.asha_workers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  worker_code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.asha_worker_localities (
  worker_id uuid not null references public.asha_workers(id) on delete cascade,
  locality_id uuid not null references public.localities(id) on delete cascade,
  primary key(worker_id, locality_id)
);
create table public.vaccination_schedule (
  code text primary key,
  vaccine_name text not null,
  dose_number integer not null check (dose_number > 0),
  due_after_days integer not null check (due_after_days >= 0),
  unique(vaccine_name, dose_number)
);
create table public.children (
  id uuid primary key default gen_random_uuid(),
  child_id text not null unique,
  name text not null check (char_length(trim(name)) >= 2),
  date_of_birth date not null,
  registration_date date not null,
  locality_id uuid not null references public.localities(id),
  assigned_worker_id uuid not null references public.asha_workers(id),
  migration_status text not null default 'Resident' check (migration_status in ('Resident', 'Migrated out')),
  family_reachability text not null default 'Reachable' check (family_reachability in ('Reachable', 'Unreachable')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_date >= date_of_birth)
);
create table public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  schedule_code text not null references public.vaccination_schedule(code),
  scheduled_date date not null,
  administered_date date not null,
  administered_by_worker_id uuid references public.asha_workers(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(child_id, schedule_code),
  check (administered_date >= scheduled_date)
);
create or replace function public.validate_vaccination_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.administered_date > current_date then
    raise exception 'Vaccination date cannot be in the future';
  end if;
  return new;
end;
$$;
create trigger vaccination_date_is_not_future before insert or update on public.vaccination_records
for each row execute procedure public.validate_vaccination_date();
create table public.outreach_tasks (
  id uuid primary key default gen_random_uuid(),
  task_code text not null unique,
  child_id uuid not null references public.children(id) on delete cascade,
  assigned_worker_id uuid not null references public.asha_workers(id),
  title text not null check (char_length(trim(title)) >= 3),
  task_type text not null default 'Follow-up',
  due_date date not null,
  priority text not null default 'Normal' check (priority in ('High', 'Normal')),
  status text not null default 'Open' check (status in ('Open', 'Completed')),
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'Completed') = (completed_at is not null))
);
create or replace function public.protect_outreach_task_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_vaxreach_admin() and (
    new.assigned_worker_id is distinct from old.assigned_worker_id or
    new.child_id is distinct from old.child_id or new.title is distinct from old.title or
    new.task_type is distinct from old.task_type or new.due_date is distinct from old.due_date or
    new.priority is distinct from old.priority
  ) then
    raise exception 'Only administrators can change task assignments or details';
  end if;
  return new;
end;
$$;
create trigger protect_outreach_task_details before update on public.outreach_tasks
for each row execute procedure public.protect_outreach_task_fields();

create index children_locality_idx on public.children(locality_id);
create index children_worker_idx on public.children(assigned_worker_id);
create index vaccination_records_child_idx on public.vaccination_records(child_id);
create index outreach_tasks_worker_status_due_idx on public.outreach_tasks(assigned_worker_id, status, due_date);

-- Fictional prototype reference data only.
insert into public.localities(name) values
 ('North Ward'), ('River Side'), ('East Colony'), ('South Market'),
 ('Central Park'), ('Lake View'), ('Hill Block'), ('Garden Enclave')
on conflict (name) do nothing;
insert into public.asha_workers(worker_code, name) values
 ('ASHA-001','Meena S.'), ('ASHA-002','Asha P.'), ('ASHA-003','Lata D.'),
 ('ASHA-004','Rekha B.'), ('ASHA-005','Rupa K.'), ('ASHA-006','Saira M.'),
 ('ASHA-007','Nirmala T.'), ('ASHA-008','Kavita R.'), ('ASHA-009','Farida A.'),
 ('ASHA-010','Sunita J.'), ('ASHA-011','Poonam C.'), ('ASHA-012','Anjali V.')
on conflict (worker_code) do nothing;
insert into public.asha_worker_localities(worker_id, locality_id)
select w.id, l.id from public.asha_workers w cross join public.localities l
where w.worker_code = 'ASHA-' || lpad((((ascii(left(l.name,1)) - ascii('A')) % 12) + 1)::text, 3, '0')
on conflict do nothing;
insert into public.vaccination_schedule(code, vaccine_name, dose_number, due_after_days) values
 ('bcg','BCG',1,0), ('opv-1','OPV',1,42), ('pentavalent-1','Pentavalent',1,42),
 ('pentavalent-2','Pentavalent',2,70), ('mr-1','MR',1,270)
on conflict (code) do nothing;

alter table public.profiles enable row level security;
alter table public.localities enable row level security;
alter table public.asha_workers enable row level security;
alter table public.asha_worker_localities enable row level security;
alter table public.vaccination_schedule enable row level security;
alter table public.children enable row level security;
alter table public.vaccination_records enable row level security;
alter table public.outreach_tasks enable row level security;

create policy "profiles readable by self or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_vaxreach_admin()));
create policy "profile owner can update name only" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update(full_name) on public.profiles to authenticated;

create policy "reference data available to signed-in users" on public.localities for select to authenticated using (true);
create policy "reference data available to signed-in users" on public.asha_workers for select to authenticated using (true);
create policy "reference data available to signed-in users" on public.asha_worker_localities for select to authenticated using (true);
create policy "schedule available to signed-in users" on public.vaccination_schedule for select to authenticated using (true);

create policy "children visible by role or assignment" on public.children for select to authenticated
using ((select public.is_vaxreach_admin()) or exists (
  select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = (select auth.uid())
) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'health_worker'));
create policy "admins insert children" on public.children for insert to authenticated
with check ((select public.is_vaxreach_admin()) and (created_by is null or created_by = (select auth.uid())));
create policy "admins update children" on public.children for update to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));
create policy "admins delete children" on public.children for delete to authenticated using ((select public.is_vaxreach_admin()));

create policy "vaccination records visible with child" on public.vaccination_records for select to authenticated
using (exists(select 1 from public.children c where c.id = vaccination_records.child_id));
create policy "authorized workers record vaccination" on public.vaccination_records for insert to authenticated
with check (exists(select 1 from public.children c where c.id = vaccination_records.child_id and (
  public.is_vaxreach_admin() or exists(select 1 from public.asha_workers w where w.id = c.assigned_worker_id and w.profile_id = auth.uid())
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'health_worker')))
  and (recorded_by is null or recorded_by = auth.uid()));
create policy "admins correct vaccination records" on public.vaccination_records for update to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));
create policy "admins remove vaccination records" on public.vaccination_records for delete to authenticated using ((select public.is_vaxreach_admin()));

create policy "tasks visible to admin or assignee" on public.outreach_tasks for select to authenticated
using ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = auth.uid())
  or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'health_worker'));
create policy "authorized users create tasks" on public.outreach_tasks for insert to authenticated
with check ((select public.is_vaxreach_admin()) or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'health_worker')
  or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = auth.uid()));
create policy "admins or assignee update tasks" on public.outreach_tasks for update to authenticated
using ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = auth.uid()))
with check ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = auth.uid()));
create policy "health workers update outreach progress" on public.outreach_tasks for update to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'health_worker'))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'health_worker'));
create policy "admins delete tasks" on public.outreach_tasks for delete to authenticated using ((select public.is_vaxreach_admin()));

grant usage on schema public to authenticated;
grant select on public.profiles, public.localities, public.asha_workers, public.asha_worker_localities, public.vaccination_schedule,
  public.children, public.vaccination_records, public.outreach_tasks to authenticated;
grant insert, update, delete on public.children, public.vaccination_records to authenticated;
grant insert, delete on public.outreach_tasks to authenticated;
grant update on public.outreach_tasks to authenticated;
