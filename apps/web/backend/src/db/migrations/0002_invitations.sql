create table invitation_guest (
  id text primary key not null,
  public_id text not null unique,
  owner_id text not null references auth_user(id) on delete cascade,
  token text not null unique,
  name text not null check (length(trim(name)) between 1 and 120),
  group_name text not null default '' check (length(group_name) <= 80),
  face_scan_required integer not null default 1 check (face_scan_required in (0, 1)),
  max_guests integer not null default 0 check (max_guests between 0 and 20),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  active integer not null default 1 check (active in (0, 1)),
  created_at text not null,
  unique (owner_id, id)
);
create index invitation_guest_owner_page on invitation_guest(owner_id, public_id);
create index invitation_guest_owner_group on invitation_guest(owner_id, group_name);
create table invitation_companion (
  id text primary key not null,
  owner_id text not null,
  guest_id text not null,
  name text not null check (length(trim(name)) between 1 and 120),
  foreign key (owner_id, guest_id) references invitation_guest(owner_id, id) on delete cascade
);
create index invitation_companion_guest on invitation_companion(owner_id, guest_id);
create table invitation_reference (
  id text primary key not null,
  owner_id text not null,
  guest_id text not null,
  image blob not null,
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
  observation text not null,
  created_at text not null,
  foreign key (owner_id, guest_id) references invitation_guest(owner_id, id) on delete cascade
);
create index invitation_reference_guest on invitation_reference(owner_id, guest_id);
create table invitation_session (
  token_hash text primary key not null,
  owner_id text not null,
  guest_id text not null,
  expires_at text not null,
  foreign key (owner_id, guest_id) references invitation_guest(owner_id, id) on delete cascade
);
create index invitation_session_guest on invitation_session(owner_id, guest_id);
