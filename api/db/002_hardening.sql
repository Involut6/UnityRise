-- Account lockout state, payment amount integrity, and indexes for hot query paths.
alter table users add column failed_logins int not null default 0;
alter table users add column locked_until timestamptz;

alter table payments add constraint payments_amount_positive check (amount > 0);
alter table payments add column provider_amount numeric(14,2);   -- amount the gateway reported on settlement

alter table audit_logs add column request_id text;

create index on transactions(member_id) where affects_savings;   -- savings balance sum
create index on loans(member_id, status);
create index on loan_schedule(due_date) where paid < principal_due + interest_due;
create index on payments(member_id, created_at desc);
create index on audit_logs(actor_id, created_at desc);
