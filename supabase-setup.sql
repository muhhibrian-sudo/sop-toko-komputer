-- Jalankan di Supabase > SQL Editor. Proyek khusus website SOP.
-- RLS menentukan izin di server/database, bukan di JavaScript.
create table if not exists public.sop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.sop_documents (
  id text primary key,
  content jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.sop_admins enable row level security;
alter table public.sop_documents enable row level security;
revoke all on public.sop_admins from anon,authenticated;
revoke all on public.sop_documents from anon,authenticated;
grant select on public.sop_admins to authenticated;
grant select on public.sop_documents to anon,authenticated;
grant insert,update on public.sop_documents to authenticated;
-- Bisa diulang tanpa konflik nama kebijakan.
drop policy if exists "Admin baca status sendiri" on public.sop_admins;
create policy "Admin baca status sendiri" on public.sop_admins for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists "Publik dapat membaca SOP" on public.sop_documents;
create policy "Publik dapat membaca SOP" on public.sop_documents for select to anon,authenticated
  using (true);
drop policy if exists "Admin boleh membuat SOP" on public.sop_documents;
create policy "Admin boleh membuat SOP" on public.sop_documents for insert to authenticated
  with check (exists (select 1 from public.sop_admins where user_id=(select auth.uid())));
drop policy if exists "Admin boleh memperbarui SOP" on public.sop_documents;
create policy "Admin boleh memperbarui SOP" on public.sop_documents for update to authenticated
  using (exists (select 1 from public.sop_admins where user_id=(select auth.uid())))
  with check (exists (select 1 from public.sop_admins where user_id=(select auth.uid())));
-- Setelah membuat admin via Supabase Authentication > Users,
-- salin User UID yang diberikan Supabase, lalu jalankan: (ganti UID saja)
-- insert into public.sop_admins(user_id) values ('UUID-USER-ADMIN-DI-SINI');
-- Jangan buat fitur pendaftaran admin publik.
