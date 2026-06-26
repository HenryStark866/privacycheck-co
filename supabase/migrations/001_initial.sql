-- ============================================================
-- CAVALTEC — Ley 1581 Autodiagnóstico
-- Migración inicial: esquema multi-tenant con RLS
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ─── organizations ──────────────────────────────────────────
create table if not exists organizations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  created_at timestamptz default now()
);

-- ─── companies ──────────────────────────────────────────────
create type company_size as enum ('micro','pequeña','mediana','grande');

create table if not exists companies (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid references organizations(id) on delete set null,
  name       text not null,
  nit        text,
  sector     text,
  size       company_size,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ─── memberships ────────────────────────────────────────────
create type member_role as enum ('administrador','evaluador','auditor');

create table if not exists memberships (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role       member_role not null default 'evaluador',
  created_at timestamptz default now(),
  unique (user_id, company_id)
);

-- ─── evaluations ────────────────────────────────────────────
create type evaluation_status as enum ('borrador','completada');

create table if not exists evaluations (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  status       evaluation_status not null default 'borrador',
  score        numeric(5,2),
  block_a      numeric(5,2),
  block_b      numeric(5,2),
  block_c      numeric(5,2),
  maturity     text,
  created_at   timestamptz default now(),
  completed_at timestamptz
);

-- ─── answers ────────────────────────────────────────────────
create table if not exists answers (
  id            uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  question_id   int not null check (question_id between 1 and 11),
  value         boolean,
  unique (evaluation_id, question_id)
);

-- ─── recommendations (caché de respuestas IA) ───────────────
create type recommendation_kind as enum ('explain','guide','interpret','action_plan');

create table if not exists recommendations (
  id            uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  kind          recommendation_kind not null,
  question_id   int,
  content       jsonb not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS) — Aislamiento multi-tenant
-- ============================================================

alter table companies      enable row level security;
alter table memberships    enable row level security;
alter table evaluations    enable row level security;
alter table answers        enable row level security;
alter table recommendations enable row level security;

-- Helper: ¿es el usuario miembro de esta empresa?
create or replace function is_member(cid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and company_id = cid
  );
$$;

-- Helper: ¿qué rol tiene el usuario en la empresa?
create or replace function my_role(cid uuid)
returns text language sql security definer as $$
  select role::text from memberships
  where user_id = auth.uid() and company_id = cid
  limit 1;
$$;

-- companies: ver solo las que el usuario es miembro
create policy "select_companies" on companies
  for select using (is_member(id));

create policy "insert_companies" on companies
  for insert with check (auth.uid() = created_by);

create policy "update_companies" on companies
  for update using (my_role(id) = 'administrador');

-- memberships: solo admins pueden gestionar y el propio usuario puede verse
create policy "select_memberships" on memberships
  for select using (user_id = auth.uid() or my_role(company_id) = 'administrador');

create policy "insert_memberships" on memberships
  for insert with check (my_role(company_id) = 'administrador' or user_id = auth.uid());

create policy "delete_memberships" on memberships
  for delete using (my_role(company_id) = 'administrador');

-- evaluations: miembros ven; evaluadores/admins escriben; auditores solo leen
create policy "select_evaluations" on evaluations
  for select using (is_member(company_id));

create policy "insert_evaluations" on evaluations
  for insert with check (
    is_member(company_id) and
    my_role(company_id) in ('administrador','evaluador')
  );

create policy "update_evaluations" on evaluations
  for update using (
    is_member(company_id) and
    my_role(company_id) in ('administrador','evaluador')
  );

-- answers: hereda el acceso de la evaluación
create policy "select_answers" on answers
  for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and is_member(e.company_id))
  );

create policy "upsert_answers" on answers
  for all using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_id
        and is_member(e.company_id)
        and my_role(e.company_id) in ('administrador','evaluador')
    )
  );

-- recommendations
create policy "select_recommendations" on recommendations
  for select using (
    exists (select 1 from evaluations e where e.id = evaluation_id and is_member(e.company_id))
  );

create policy "insert_recommendations" on recommendations
  for insert with check (
    exists (select 1 from evaluations e where e.id = evaluation_id and is_member(e.company_id))
  );

-- ─── Índices ────────────────────────────────────────────────
create index if not exists idx_memberships_user    on memberships(user_id);
create index if not exists idx_memberships_company on memberships(company_id);
create index if not exists idx_evaluations_company on evaluations(company_id);
create index if not exists idx_answers_evaluation  on answers(evaluation_id);
create index if not exists idx_recommendations_evaluation on recommendations(evaluation_id);
