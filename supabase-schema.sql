-- GoHalal — Halal Readiness Check
-- Jalankan seluruh isi file ini di Supabase Dashboard → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Satu baris per orang yang menyelesaikan quiz DAN submit form kontak (satu-satunya
-- gerbang kontak di seluruh alur, muncul sekali setelah skor headline). Tidak ada
-- partial/progressive save lagi -- satu insert, sekali jadi.
create table if not exists quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  business_type text,
  has_certificate boolean,
  email text,
  overall_score numeric,
  readiness_category text,
  complexity text,
  dimension_scores jsonb,
  critical_gaps jsonb,
  answers jsonb,
  completed boolean not null default false,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

-- Untuk database yang sudah live dari sebelum kolom ini ditambahkan
-- (aman dijalankan ulang, tidak error kalau kolomnya sudah ada).
alter table quiz_submissions add column if not exists business_name text;
alter table quiz_submissions add column if not exists email text;
alter table quiz_submissions add column if not exists completed boolean not null default false;

-- Data kontak yang diisi untuk membuka hasil lengkap (lead capture)
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references quiz_submissions(id) on delete set null,
  name text not null,
  business_name text not null,
  whatsapp text,
  email text,
  consent boolean not null default false,
  recommended_service text,
  lead_status text not null default 'New',
  notes text,
  created_at timestamptz not null default now()
);

-- Untuk database yang sudah ada dari sebelum kolom email ditambahkan
-- (aman dijalankan ulang, tidak akan error kalau kolomnya sudah ada).
alter table leads add column if not exists email text;

-- Nomor WhatsApp tidak lagi diminta di form (kontak lewat email), jadi kolomnya
-- dibuat opsional. Aman dijalankan ulang.
alter table leads alter column whatsapp drop not null;

alter table quiz_submissions enable row level security;
alter table leads enable row level security;

-- Form publik di website HANYA boleh menyimpan (insert) data baru,
-- tidak boleh membaca (select), mengubah (update), atau menghapus (delete)
-- data siapa pun — termasuk datanya sendiri. Supaya leads competitor
-- tidak bisa dibaca orang lain lewat browser console.
drop policy if exists "public can insert quiz submissions" on quiz_submissions;
drop policy if exists "public can update quiz submissions" on quiz_submissions;
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
