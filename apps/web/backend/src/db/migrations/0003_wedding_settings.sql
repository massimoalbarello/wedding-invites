create table wedding_settings (
  owner_id text primary key not null references auth_user(id) on delete cascade,
  couple_names text not null check (length(trim(couple_names)) between 1 and 120),
  ceremony_date text not null check (length(ceremony_date) = 10)
);
