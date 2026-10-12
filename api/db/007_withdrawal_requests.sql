-- Withdrawals are requested by the member and paid out by finance staff. The savings ledger only changes when it is paid;
-- until then the requested amount is held (see availableBalance in ledger.ts).
create table withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  amount numeric(14,2) not null check (amount > 0),
  bank_code text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','paid','rejected','cancelled')),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  review_note text,
  reference text unique,
  created_at timestamptz not null default now()
);
create index on withdrawal_requests(member_id, created_at desc);
create index on withdrawal_requests(status, created_at);
