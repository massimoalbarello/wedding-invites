create table invitation_capture (
  id text primary key not null,
  owner_id text not null,
  guest_id text not null,
  image blob not null,
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at text not null,
  foreign key (owner_id, guest_id) references invitation_guest(owner_id, id) on delete cascade
);
create index invitation_capture_guest on invitation_capture(owner_id, guest_id);
