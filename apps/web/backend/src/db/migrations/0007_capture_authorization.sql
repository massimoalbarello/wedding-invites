alter table invitation_capture add column authorized integer check (authorized in (0, 1));
