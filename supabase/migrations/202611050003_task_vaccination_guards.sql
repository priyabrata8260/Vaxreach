-- Close task field-level authorization gaps and validate scheduled doses using
-- the existing public.vaccination_schedule rows. Existing records are untouched.

alter table public.outreach_tasks
  add column completion_notes text,
  add column follow_up_outcome text;

alter table public.outreach_tasks
  add constraint outreach_task_completion_notes_length
    check (completion_notes is null or char_length(completion_notes) <= 2000),
  add constraint outreach_task_follow_up_outcome_length
    check (follow_up_outcome is null or char_length(follow_up_outcome) <= 500);

-- Authenticated users no longer have table-wide UPDATE. Admin management fields
-- are column-granted; the trigger below limits ASHA changes to three fields.
revoke update on table public.outreach_tasks from authenticated;
grant update (
  assigned_worker_id, child_id, title, task_type, due_date, priority, status,
  completion_notes, follow_up_outcome
) on table public.outreach_tasks to authenticated;

drop policy if exists "tasks visible to admin or assignee" on public.outreach_tasks;
drop policy if exists "authorized users create tasks" on public.outreach_tasks;
drop policy if exists "admins or assignee update tasks" on public.outreach_tasks;
drop policy if exists "health workers update outreach progress" on public.outreach_tasks;
drop policy if exists "admins delete tasks" on public.outreach_tasks;
drop policy if exists "admins and assigned ASHA workers read tasks" on public.outreach_tasks;
drop policy if exists "admins or assigned ASHA create tasks" on public.outreach_tasks;
drop policy if exists "admins or assigned ASHA update tasks" on public.outreach_tasks;

create policy "admins and assigned ASHA read current tasks" on public.outreach_tasks for select to authenticated
using (
  (select public.is_vaxreach_admin())
  or exists (
    select 1
    from public.asha_workers w
    join public.children c on c.assigned_worker_id = w.id
    where w.id = public.outreach_tasks.assigned_worker_id
      and w.profile_id = (select auth.uid())
      and w.active
      and c.id = public.outreach_tasks.child_id
  )
);

create policy "admins or assigned ASHA create tasks" on public.outreach_tasks for insert to authenticated
with check (
  (select public.is_vaxreach_admin())
  or exists (
    select 1
    from public.asha_workers w
    join public.children c on c.assigned_worker_id = w.id
    where w.id = public.outreach_tasks.assigned_worker_id
      and w.profile_id = (select auth.uid())
      and w.active
      and c.id = public.outreach_tasks.child_id
      and (created_by is null or created_by = (select auth.uid()))
  )
);

create policy "admins or assigned ASHA update tasks" on public.outreach_tasks for update to authenticated
using (
  (select public.is_vaxreach_admin())
  or exists (
    select 1
    from public.asha_workers w
    join public.children c on c.assigned_worker_id = w.id
    where w.id = public.outreach_tasks.assigned_worker_id
      and w.profile_id = (select auth.uid())
      and w.active
      and c.id = public.outreach_tasks.child_id
  )
)
with check (
  (select public.is_vaxreach_admin())
  or exists (
    select 1
    from public.asha_workers w
    join public.children c on c.assigned_worker_id = w.id
    where w.id = public.outreach_tasks.assigned_worker_id
      and w.profile_id = (select auth.uid())
      and w.active
      and c.id = public.outreach_tasks.child_id
  )
);

create policy "admins delete tasks" on public.outreach_tasks for delete to authenticated
using ((select public.is_vaxreach_admin()));

create or replace function public.protect_outreach_task_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  linked_worker_id uuid;
begin
  if public.is_vaxreach_admin() then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
      if new.status is distinct from old.status then
        if new.status = 'Completed' then
          new.completed_at := now();
          new.completed_by := auth.uid();
        else
          new.completed_at := null;
          new.completed_by := null;
        end if;
      end if;
    elsif tg_op = 'INSERT' then
      new.created_by := coalesce(new.created_by, auth.uid());
      if new.status = 'Completed' and new.completed_at is null then
        new.completed_at := now();
        new.completed_by := auth.uid();
      end if;
      new.updated_at := now();
    end if;
    return new;
  end if;

  select w.id into linked_worker_id
  from public.asha_workers w
  join public.profiles p on p.id = w.profile_id
  where w.profile_id = (select auth.uid())
    and w.active
    and p.role = 'asha_worker';

  if linked_worker_id is null then
    raise exception 'An active ASHA worker profile is required';
  end if;

  if tg_op = 'INSERT' then
    if new.assigned_worker_id is distinct from linked_worker_id
      or not exists (
        select 1 from public.children c
        where c.id = new.child_id and c.assigned_worker_id = linked_worker_id
      ) then
      raise exception 'ASHA workers may create tasks only for their assigned children';
    end if;
    if new.status <> 'Open' or new.completed_at is not null or new.completed_by is not null then
      raise exception 'ASHA workers must create tasks in the Open state';
    end if;
    if new.created_by is not null and new.created_by is distinct from auth.uid() then
      raise exception 'ASHA workers cannot set another task creator';
    end if;
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if old.assigned_worker_id is distinct from linked_worker_id
    or not exists (
      select 1 from public.children c
      where c.id = old.child_id and c.assigned_worker_id = linked_worker_id
    ) then
    raise exception 'ASHA workers may update only tasks for children currently assigned to them';
  end if;

  if new.id is distinct from old.id
    or new.task_code is distinct from old.task_code
    or new.child_id is distinct from old.child_id
    or new.assigned_worker_id is distinct from old.assigned_worker_id
    or new.title is distinct from old.title
    or new.task_type is distinct from old.task_type
    or new.due_date is distinct from old.due_date
    or new.priority is distinct from old.priority
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.updated_at is distinct from old.updated_at
    or new.completed_by is distinct from old.completed_by
    or new.completed_at is distinct from old.completed_at then
    raise exception 'ASHA workers may change only status, completion notes or follow-up outcome';
  end if;

  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'Completed' then
      new.completed_at := now();
      new.completed_by := auth.uid();
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_outreach_task_creation on public.outreach_tasks;
create trigger protect_outreach_task_creation
before insert on public.outreach_tasks
for each row execute procedure public.protect_outreach_task_fields();

-- Keep open follow-up work attached to the new owner when an administrator
-- reassigns a child. Completed tasks retain their original assignment.
create or replace function public.reassign_open_tasks_with_child()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.assigned_worker_id is distinct from old.assigned_worker_id then
    update public.outreach_tasks
    set assigned_worker_id = new.assigned_worker_id
    where child_id = new.id and status = 'Open';
  end if;
  return new;
end;
$$;
create trigger reassign_open_tasks_after_child_assignment
after update of assigned_worker_id on public.children
for each row execute procedure public.reassign_open_tasks_with_child();

-- Keep the existing schedule table authoritative. This only validates writes;
-- it neither changes the schedule nor rewrites existing vaccination records.
create or replace function public.validate_vaccination_date()
returns trigger language plpgsql set search_path = '' as $$
declare
  expected_scheduled_date date;
begin
  select c.date_of_birth + s.due_after_days
    into expected_scheduled_date
  from public.children c
  join public.vaccination_schedule s on s.code = new.schedule_code
  where c.id = new.child_id;

  if expected_scheduled_date is null then
    raise exception 'Child or vaccination schedule entry was not found';
  end if;
  if new.scheduled_date is distinct from expected_scheduled_date then
    raise exception 'Scheduled date must match the child date of birth and stored vaccine schedule';
  end if;
  if new.administered_date < expected_scheduled_date then
    raise exception 'Vaccination date cannot be earlier than its scheduled date';
  end if;
  if new.administered_date > current_date then
    raise exception 'Vaccination date cannot be in the future';
  end if;
  return new;
end;
$$;
drop trigger if exists vaccination_date_is_not_future on public.vaccination_records;
create trigger vaccination_schedule_dates_valid
before insert or update on public.vaccination_records
for each row execute procedure public.validate_vaccination_date();
