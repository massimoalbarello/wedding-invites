const names = ['Massimo', 'Elizaveta'] as const;

export const content = {
  names,
  nameLabel: names.join(' & '),
  date: '2027-06-30',
  startsAt: '2027-06-30T17:00:00+02:00',
  dateLabel: '30 June 2027',
  venue: 'Villa Ex Magni Rizzoli',
};
