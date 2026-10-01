-- Uploaded documents live in Postgres so the API can run on serverless hosts (no persistent disk).
alter table kyc_documents add column content bytea, add column mime text;
alter table kyc_documents alter column storage_key drop not null;
alter table loan_documents add column content bytea, add column mime text;
alter table loan_documents alter column storage_key drop not null;
