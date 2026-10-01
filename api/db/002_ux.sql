create table login_events (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  ip text, user_agent text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index on login_events(user_id, created_at desc);
create table loan_documents (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  filename text not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);
alter table investment_schemes add column opened_at timestamptz;
alter table users add column password_changed_at timestamptz;
