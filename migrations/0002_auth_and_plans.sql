create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamp not null default now()
);

create table if not exists user_plans (
  id serial primary key,
  user_id integer not null references users(id),
  importer_quota integer not null default 0,
  exporter_quota integer not null default 0,
  ncm_quota integer not null default 0,
  billing_cycle text not null,
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,
  status text not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists user_plans_user_idx on user_plans(user_id);
create index if not exists user_plans_status_idx on user_plans(status);

create table if not exists user_entitlements (
  id serial primary key,
  user_id integer not null references users(id),
  target_kind text not null,
  company_id integer references companies(id),
  ncm_code text,
  label text not null,
  created_at timestamp not null default now()
);

create index if not exists user_entitlements_kind_idx on user_entitlements(user_id, target_kind);
create index if not exists user_entitlements_company_idx on user_entitlements(user_id, company_id);
create index if not exists user_entitlements_ncm_idx on user_entitlements(user_id, ncm_code);
