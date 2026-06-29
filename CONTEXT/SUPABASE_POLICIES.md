# Supabase RLS policies for admin protection

Apply these SQL snippets in your Supabase SQL editor to add an `is_admin` flag and protect sensitive tables. Adjust table/column names to match your schema.

1) Add `is_admin` to `profiles` (run once):

```sql
alter table profiles
  add column if not exists is_admin boolean default false;

-- grant select/update on profiles to authenticated users if needed
```

2) Enable Row-Level Security on sensitive tables and add policies. Example for `classes`:

```sql
-- enable RLS
alter table classes enable row level security;

-- allow admins full access
create policy "admins manage classes"
  on classes
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
```

3) Example for `sessions` (only admins can create/stop sessions):

```sql
alter table sessions enable row level security;

create policy "admins manage sessions"
  on sessions
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
```

4) Example for `attendance_logs` (allow inserts from service or authenticated users but restrict modifications):

```sql
alter table attendance_logs enable row level security;

-- allow authenticated users to insert their own attendance record via server-side validated flows
create policy "allow inserts via service_role_or_admin"
  on attendance_logs
  for insert
  with check (
    -- if your client inserts directly, validate the session and student relation on server side
    true
  );

-- prevent updates/deletes unless admin
create policy "admins update delete attendance"
  on attendance_logs
  for update, delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
```

5) Notes
- Policies that call `auth.uid()` require requests authenticated with Supabase JWT (client or service_role). For truly server-only operations, use a server-side function (Vercel Function) that runs with the `service_role` key.
- Use `maybeSingle()` or checks in your client to avoid leaking admin UI. Client-side guards are UX only — RLS is the security boundary.
