-- Perbaikan policy RLS untuk quiz_submissions & leads
-- Aman dijalankan berkali-kali (idempotent)

alter table quiz_submissions enable row level security;
alter table leads enable row level security;

drop policy if exists "public can insert quiz submissions" on quiz_submissions;
drop policy if exists "public can insert leads" on leads;

create policy "public can insert quiz submissions"
  on quiz_submissions
  as permissive
  for insert
  to anon, authenticated
  with check (true);

create policy "public can insert leads"
  on leads
  as permissive
  for insert
  to anon, authenticated
  with check (true);

-- Cek hasilnya: harus muncul 2 baris (quiz_submissions & leads),
-- kolom "roles" berisi {anon,authenticated}, kolom "cmd" berisi INSERT
select schemaname, tablename, policyname, roles, cmd, with_check
from pg_policies
where tablename in ('quiz_submissions','leads');
