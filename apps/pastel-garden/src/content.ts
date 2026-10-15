const names = ['Massimo', 'Elizaveta'] as const;

export const content = {
  names,
  nameLabel: names.join(' & '),
  date: '2027-06-29',
  dateLabel: '29 June 2027',
  venue: 'Castello di Casiglio',
};
