-- GoHalal — Halal Readiness Check
-- Jalankan seluruh isi file ini di Supabase Dashboard → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Setiap kali seseorang menyelesaikan 25 pertanyaan quiz
create table if not exists quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  business_type text,
  has_certificate boolean,
  overall_score numeric,
  readiness_category text,
  complexity text,
  dimension_scores jsonb,
  critical_gaps jsonb,
  answers jsonb,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

-- Data kontak yang diisi untuk membuka hasil lengkap (lead capture)
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references quiz_submissions(id) on delete set null,
  name text not null,
  business_name text not null,
  whatsapp text not null,
  consent boolean not null default false,
  recommended_service text,
  lead_status text not null default 'New',
  notes text,
  created_at timestamptz not null default now()
);

alter table quiz_submissions enable row level security;
alter table leads enable row level security;

-- Form publik di website HANYA boleh menyimpan (insert) data baru,
-- tidak boleh membaca (select), mengubah (update), atau menghapus (delete)
-- data siapa pun — termasuk datanya sendiri. Supaya leads competitor
-- tidak bisa dibaca orang lain lewat browser console.
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

-- Untuk melihat data leads & submissions, gunakan Supabase Dashboard →
-- Table Editor (login dengan akun Supabase kamu, bukan lewat website publik).
