create table invitation_design (
  owner_id text primary key not null references auth_user(id) on delete cascade,
  package_id text not null
);
