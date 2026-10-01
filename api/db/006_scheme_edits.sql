-- Every change a super admin makes to an investment scheme, with before/after values and a reason.
create table investment_scheme_edits (
  id bigserial primary key,
  scheme_id uuid not null references investment_schemes(id) on delete cascade,
  edited_by uuid references users(id),
  changes jsonb not null,          -- { field: { from, to } }
  reason text,
  created_at timestamptz not null default now()
);
create index on investment_scheme_edits(scheme_id, id desc);
