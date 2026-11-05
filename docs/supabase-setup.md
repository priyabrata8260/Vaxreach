# Supabase setup and authentication

VaxReach uses Supabase Auth and Postgres when both Vite environment variables are present. Copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and restart Vite. These browser values are public; never use a service-role key in the frontend or commit `.env.local`. Without Supabase configuration the app stays in its local synthetic demonstration mode and does not provide production authentication.

## Apply database changes

Apply these migrations in order using the Supabase CLI or SQL editor:

1. `supabase/migrations/202611050001_vaxreach_schema.sql`
2. `supabase/migrations/202611050002_auth_rbac.sql`
3. `supabase/migrations/202611050003_task_vaccination_guards.sql`
4. `supabase/migrations/202611050004_admin_worker_management_grants.sql`

The second migration converts the old `admin` role to `administrator` and `health_worker` to `asha_worker`. Existing ASHA accounts need a worker roster assignment before they can enter the app.

## Create and assign accounts

Create accounts in Supabase Auth; public sign-up is not enabled. New profiles default to `asha_worker` and cannot access child data until assigned a worker. Promote an administrator using SQL in the Supabase SQL editor:

```sql
update public.profiles
set role = 'administrator'
where id = (select id from auth.users where email = 'admin@example.test');
```

Link an ASHA account to its roster row:

```sql
update public.asha_workers
set profile_id = (select id from auth.users where email = 'asha@example.test')
where worker_code = 'ASHA-001';
```

The profile role is read from the protected `profiles` table after sign-in. Application users can update their display name only; role changes require database administrator access. ASHA profiles without an active linked worker are denied access.

## Sign-in workflow

- Email plus password uses Supabase Auth `signInWithPassword` directly.
- A Supabase Auth user UUID plus password uses the `login-by-id` Edge Function. Deploy it with `supabase functions deploy login-by-id`. The function resolves the UUID server-side, verifies the account role/worker assignment, delegates password verification and token issuance to Supabase Auth, and never returns the account email. Its service-role key is read from Supabase Edge Function secrets, not frontend variables.
- Supabase Auth persists and refreshes the session in browser storage. Sign out calls `supabase.auth.signOut()` and clears that session.
- An authenticated session without a valid profile role is blocked from all routes. Admins land on the programme dashboard and can access management routes. ASHA workers land on a dashboard scoped by RLS and can access their assigned child registry, vaccination tracker and outreach tasks. Attempts to open administrator routes redirect to the dashboard.

## Database access rules

RLS is enabled on every application table. Admins can manage the child registry, ASHA roster, outreach assignments and reference tables. ASHA workers can read only their assigned children, vaccination history and follow-up tasks. They can record doses for assigned children and update completion status on their own tasks. A database trigger prevents ASHA users from changing task assignment or task details. Admin-only pages are also hidden and route guarded in React, while Postgres RLS remains the enforcement boundary.

The third migration restricts ASHA task changes to status, completion notes and follow-up outcome, and sets completion/audit fields in the database. It also checks that each vaccination's scheduled date equals the child's date of birth plus `due_after_days` from the existing `vaccination_schedule` table. It does not edit existing vaccination rows or change the schedule.

The fourth migration grants authenticated API users table-level write privileges for the ASHA roster and worker-locality assignments. The existing administrator-only RLS policies still deny these writes to ASHA accounts.

The migration seeds only fictional reference localities, ASHA roster names and the simplified demo vaccination schedule. It does not seed children. Browser-local synthetic data is not uploaded automatically when cloud mode is enabled.

## CSV imports

The current VaxReach workspace has CSV export, but no CSV import/upload module. No role can upload CSV data until that module and its server-side validation are implemented. Any future upload route should be administrator-only by default and must retain the same RLS checks for every imported row.

The sample vaccination schedule is only a prototype assumption, not clinical guidance. Do not store real personal health information in this hackathon project.
