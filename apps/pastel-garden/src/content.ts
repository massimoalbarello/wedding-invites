const names = ['Massimo', 'Elizaveta'] as const;

export const content = {
  names,
  nameLabel: names.join(' & '),
  date: '2027-06-29',
  startsAt: '2027-06-29T17:00:00+02:00',
  dateLabel: '29 June 2027',
  timeLabel: '5:00 pm · Italy',
  venue: 'Castello di Casiglio',
};
