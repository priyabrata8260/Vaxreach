-- Outreach tasks are created by administrators; assigned ASHA workers retain
-- the existing RLS-protected ability to update their assigned tasks.
drop policy if exists "admins or assigned ASHA create tasks" on public.outreach_tasks;

create policy "admins create tasks"
on public.outreach_tasks
for insert
to authenticated
with check ((select public.is_vaxreach_admin()));

create or replace function public.enforce_admin_outreach_task_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_vaxreach_admin() then
    raise exception 'Only administrators may create outreach tasks';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_only_outreach_task_insert on public.outreach_tasks;
create trigger admin_only_outreach_task_insert
before insert on public.outreach_tasks
for each row
execute procedure public.enforce_admin_outreach_task_insert();
