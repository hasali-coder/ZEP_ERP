create table if not exists app_private.finance_reset_archives (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 reason text not null,
 snapshot jsonb not null
);
alter table app_private.finance_reset_archives enable row level security;
revoke all on app_private.finance_reset_archives from public,anon,authenticated;;
