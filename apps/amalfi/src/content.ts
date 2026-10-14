const startsAt = '2027-06-29T16:00:00+02:00';
const replyBy = '2027-05-29T12:00:00+02:00';
const locale = 'en-US';
const timeZone = 'Europe/Rome';

export const content = {
  names: ['Elena', 'Marco'],
  startsAt,
  endsAt: '2027-06-30T01:00:00+02:00',
  dateLabel: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(
    new Date(startsAt),
  ),
  dayLabel: new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(new Date(startsAt)),
  place: 'Positano · Amalfi Coast, Italy',
  replyBy: new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(
    new Date(replyBy),
  ),
  schedule: [
    { time: '4:00 PM', title: 'Ceremony', detail: 'Wedding vows on the sea-facing terrace' },
    {
      time: '5:00 PM',
      title: 'Aperitivo',
      detail: 'A toast, something delicious, and a little sunshine',
    },
    { time: '7:30 PM', title: 'Dinner al fresco', detail: 'A long table and an evening together' },
    { time: '10:00 PM', title: 'Dancing', detail: 'One more song, then another' },
  ],
  gallery: [
    { src: 'couple-1-lemon-grove-walk.webp', alt: 'Walking hand in hand under the lemon trees' },
    { src: 'couple-2-embrace-sea.webp', alt: 'An embrace above the sea' },
    { src: 'couple-3-positano-view.webp', alt: 'Looking out over Positano' },
    { src: 'couple-5-terrace-dance.webp', alt: 'Dancing on the terrace at sunset' },
  ],
  faq: [
    {
      question: 'Can we bring the kids?',
      answer:
        'We’re planning a celebration for grown-ups. Please check your invitation’s guest allowance when sending your reply.',
    },
    {
      question: 'Where do we park?',
      answer:
        'Parking is limited along the coast. Our shuttle leaves Positano main square at 3:15 PM.',
    },
    {
      question: 'What if it rains?',
      answer:
        'We have a beautiful covered terrace ready. The celebration will go ahead, whatever the weather.',
    },
    {
      question: 'When should we reply?',
      answer:
        'Please send your reply by May 29, 2027. You can return to your personal link to update it.',
    },
  ],
};
