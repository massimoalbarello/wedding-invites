alter table invitation_guest rename column name to first_name;
alter table invitation_guest add column last_name text not null default ''
  check (length(last_name) <= 120);
