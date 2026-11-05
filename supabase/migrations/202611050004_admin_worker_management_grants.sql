-- Enable the administrator-only ASHA roster and locality-management policies.
-- RLS remains responsible for rejecting writes from ASHA worker accounts.
grant insert, update, delete on table public.asha_workers to authenticated;
grant insert, update, delete on table public.asha_worker_localities to authenticated;
