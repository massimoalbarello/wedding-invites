const names = ['Massimo', 'Elizaveta'] as const;

export const content = {
  names,
  nameLabel: names.join(' & '),
  date: '2027-06-28',
  startsAt: '2027-06-28T17:00:00+02:00',
  dateLabel: '28 June 2027',
  venue: 'Villa Ex Magni Rizzoli',
};
