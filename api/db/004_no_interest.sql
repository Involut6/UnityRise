-- Loans are interest-free. Approval authority moves to the loan manager (or super admin).
alter type user_role rename value 'loan_officer' to 'loan_manager';

alter table loan_schedule drop column interest_due;      -- also drops the partial index from 002 that referenced it
create index on loan_schedule(due_date) where paid < principal_due;
alter table loans drop column annual_rate_pct;
alter table loan_products drop column annual_rate_pct;
