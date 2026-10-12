-- Day of the month a member wants to have reached their savings goal by (null = last day of the month).
alter table wallets add column goal_due_day int check (goal_due_day between 1 and 28);
