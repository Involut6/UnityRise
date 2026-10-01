create extension if not exists pgcrypto;

create type user_role as enum ('member','loan_officer','accountant','admin','super_admin');
create type kyc_status as enum ('draft','submitted','approved','rejected');
create type txn_type as enum ('contribution','topup','withdrawal','interest','loan_disbursement','loan_repayment','investment_subscription','investment_return','penalty');
create type loan_status as enum ('pending','guarantors_pending','under_review','approved','rejected','active','completed','defaulted');
create type scheme_status as enum ('draft','open','closed','matured');

create sequence membership_seq start 1;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text unique,
  password_hash text not null,
  role user_role not null default 'member',
  totp_secret text,
  totp_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references users(id),
  membership_id text unique,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  bvn text, nin text,
  address text,
  kyc_status kyc_status not null default 'draft',
  kyc_note text,
  reviewed_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table kyc_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('photo','id_card','signature','proof_of_address')),
  filename text not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

-- Savings: one wallet per member; balances derived from immutable ledger
create table wallets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid unique not null references members(id),
  monthly_target numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create table transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  type txn_type not null,
  amount numeric(14,2) not null check (amount > 0),
  direction smallint not null check (direction in (1,-1)), -- +1 credit to savings, -1 debit
  affects_savings boolean not null default true,
  reference text unique,
  narration text,
  created_at timestamptz not null default now()
);
create index on transactions(member_id, created_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  provider text not null check (provider in ('paystack','flutterwave','manual')),
  reference text unique not null,
  purpose text not null, -- topup | loan_repayment | investment
  purpose_ref uuid,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table investment_schemes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('real_estate','treasury_bills','agriculture','equipment_leasing','business_financing')),
  description text,
  target_amount numeric(14,2) not null,
  min_amount numeric(14,2) not null default 0,
  duration_months int not null,
  projected_roi_pct numeric(6,2) not null,
  risk_profile text not null check (risk_profile in ('low','medium','high')),
  status scheme_status not null default 'draft',
  created_by uuid references users(id),
  approved_by uuid references users(id),
  matured_at timestamptz,
  created_at timestamptz not null default now()
);
create table investment_subscriptions (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references investment_schemes(id),
  member_id uuid not null references members(id),
  amount numeric(14,2) not null check (amount > 0),
  payout numeric(14,2),
  created_at timestamptz not null default now()
);

create table loan_products (
  code text primary key,
  name text not null,
  annual_rate_pct numeric(5,2) not null,
  max_multiple_of_savings numeric(4,1) not null,
  max_tenor_months int not null
);
insert into loan_products values
 ('emergency','Emergency Loan',8,1.0,6),
 ('personal','Personal Loan',12,2.0,24),
 ('business','Business Loan',15,3.0,36),
 ('housing','Housing Loan',12,4.0,120),
 ('asset','Asset Acquisition Loan',14,3.0,48),
 ('education','Education Loan',10,2.0,36);

create table loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  product_code text not null references loan_products(code),
  principal numeric(14,2) not null check (principal > 0),
  tenor_months int not null check (tenor_months > 0),
  annual_rate_pct numeric(5,2) not null,
  purpose text,
  status loan_status not null default 'guarantors_pending',
  approvals int not null default 0,
  rejected_reason text,
  disbursed_at timestamptz,
  created_at timestamptz not null default now()
);
create table loan_guarantors (
  loan_id uuid references loans(id) on delete cascade,
  member_id uuid references members(id),
  consent text not null default 'pending' check (consent in ('pending','accepted','declined')),
  responded_at timestamptz,
  primary key (loan_id, member_id)
);
create table loan_approvals (
  loan_id uuid references loans(id) on delete cascade,
  approver_id uuid references users(id),
  decision text not null check (decision in ('approve','reject')),
  note text,
  created_at timestamptz not null default now(),
  primary key (loan_id, approver_id)
);
create table loan_schedule (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  installment_no int not null,
  due_date date not null,
  principal_due numeric(14,2) not null,
  interest_due numeric(14,2) not null,
  penalty numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  unique (loan_id, installment_no)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'notice' check (kind in ('notice','meeting','agm')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(member_id, created_at desc);

create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  is_resolution boolean not null default false,
  closes_at timestamptz not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create table votes (
  poll_id uuid references polls(id) on delete cascade,
  member_id uuid references members(id),
  option_index int not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, member_id) -- one member, one vote
);
create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  held_at timestamptz not null,
  venue text,
  minutes text,
  created_by uuid references users(id)
);
create table meeting_attendance (
  meeting_id uuid references meetings(id) on delete cascade,
  member_id uuid references members(id),
  checked_in_at timestamptz not null default now(),
  primary key (meeting_id, member_id)
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index on audit_logs(created_at desc);
