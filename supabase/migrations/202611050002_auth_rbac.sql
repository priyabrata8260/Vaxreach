-- Tighten VaxReach access to the two supported application roles.
-- Existing health_worker profiles are migrated to ASHA; admins must link them
-- to their matching roster row before they regain child/task access.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'administrator' where role = 'admin';
update public.profiles set role = 'asha_worker' where role = 'health_worker';
alter table public.profiles alter column role set default 'asha_worker';
alter table public.profiles add constraint profiles_role_check check (role in ('administrator', 'asha_worker'));

create or replace function public.is_vaxreach_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'administrator');
$$;

drop policy if exists "reference data available to signed-in users" on public.asha_workers;
create policy "admin or linked ASHA worker can read worker profile" on public.asha_workers for select to authenticated
using ((select public.is_vaxreach_admin()) or profile_id = (select auth.uid()));
create policy "admins manage ASHA worker profiles" on public.asha_workers for all to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));

drop policy if exists "reference data available to signed-in users" on public.asha_worker_localities;
create policy "admin or linked ASHA can read service areas" on public.asha_worker_localities for select to authenticated
using ((select public.is_vaxreach_admin()) or exists (
  select 1 from public.asha_workers w where w.id = worker_id and w.profile_id = (select auth.uid())
));
create policy "admins manage worker service areas" on public.asha_worker_localities for all to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));

drop policy if exists "children visible by role or assignment" on public.children;
create policy "admins and assigned ASHA workers read children" on public.children for select to authenticated
using ((select public.is_vaxreach_admin()) or exists (
  select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = (select auth.uid()) and w.active
));

drop policy if exists "vaccination records visible with child" on public.vaccination_records;
create policy "users read vaccination records for visible children" on public.vaccination_records for select to authenticated
using (exists(select 1 from public.children c where c.id = child_id));
drop policy if exists "authorized workers record vaccination" on public.vaccination_records;
create policy "admins or assigned ASHA workers record vaccination" on public.vaccination_records for insert to authenticated
with check (exists(select 1 from public.children c where c.id = child_id and (
  public.is_vaxreach_admin() or exists(select 1 from public.asha_workers w where w.id = c.assigned_worker_id and w.profile_id = auth.uid() and w.active)
)) and (recorded_by is null or recorded_by = auth.uid()) and (
  administered_by_worker_id is null or administered_by_worker_id = (select w.id from public.asha_workers w where w.profile_id = auth.uid()) or public.is_vaxreach_admin()
));
drop policy if exists "admins correct vaccination records" on public.vaccination_records;
create policy "admins correct vaccination records" on public.vaccination_records for update to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));
drop policy if exists "admins remove vaccination records" on public.vaccination_records;
create policy "admins remove vaccination records" on public.vaccination_records for delete to authenticated
using ((select public.is_vaxreach_admin()));

drop policy if exists "tasks visible to admin or assignee" on public.outreach_tasks;
drop policy if exists "authorized users create tasks" on public.outreach_tasks;
drop policy if exists "admins or assignee update tasks" on public.outreach_tasks;
drop policy if exists "health workers update outreach progress" on public.outreach_tasks;
drop policy if exists "admins delete tasks" on public.outreach_tasks;
create policy "admins and assigned ASHA workers read tasks" on public.outreach_tasks for select to authenticated
using ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = (select auth.uid()) and w.active));
create policy "admins or assigned ASHA create tasks" on public.outreach_tasks for insert to authenticated
with check ((select public.is_vaxreach_admin()) or exists(
  select 1 from public.asha_workers w join public.children c on c.assigned_worker_id = w.id
  where w.id = assigned_worker_id and w.profile_id = (select auth.uid()) and w.active and c.id = child_id
));
create policy "admins or assigned ASHA update tasks" on public.outreach_tasks for update to authenticated
using ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = (select auth.uid()) and w.active))
with check ((select public.is_vaxreach_admin()) or exists(select 1 from public.asha_workers w where w.id = assigned_worker_id and w.profile_id = (select auth.uid()) and w.active));
create policy "admins delete tasks" on public.outreach_tasks for delete to authenticated
using ((select public.is_vaxreach_admin()));

-- ASHA users may complete/reopen only their assigned task. They cannot alter
-- its child, assignee, title, due date, task type or priority.
create or replace function public.protect_outreach_task_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_vaxreach_admin() and (
    new.assigned_worker_id is distinct from old.assigned_worker_id or
    new.child_id is distinct from old.child_id or new.title is distinct from old.title or
    new.task_type is distinct from old.task_type or new.due_date is distinct from old.due_date or
    new.priority is distinct from old.priority or
    (new.status = 'Completed' and new.completed_by is distinct from auth.uid())
  ) then
    raise exception 'ASHA workers may only update completion status on assigned tasks';
  end if;
  return new;
end;
$$;

-- Remove broad reference table writes and keep administration inside RLS.
create policy "admins manage localities" on public.localities for all to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));
create policy "admins manage vaccination schedule" on public.vaccination_schedule for all to authenticated
using ((select public.is_vaxreach_admin())) with check ((select public.is_vaxreach_admin()));
