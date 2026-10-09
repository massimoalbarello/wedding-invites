import assert from 'node:assert/strict';
import type { virtualPasskeyBrowser } from '@repo/browser-testing/browser';

type Page = Awaited<ReturnType<typeof virtualPasskeyBrowser>>['page'];
type Guest = { id: string; name: string; token: string };

const EXAMPLE_GUESTS = [
  { name: 'Alex Rivera', groupName: 'Friends', maxGuests: 1 },
  { name: 'Sam Taylor', groupName: 'Friends', maxGuests: 0 },
  { name: 'Jamie Chen', groupName: 'Family', maxGuests: 2 },
  { name: 'Robin Ellis', groupName: 'Family', maxGuests: 0 },
  { name: 'Morgan Bell', groupName: 'Friends', maxGuests: 1 },
  { name: 'Charlie Lane', groupName: '', maxGuests: 0 },
];

/** Disposable examples are created through the same authenticated API as the dashboard. */
export async function seedGuests({ page, origin }: { page: Page; origin: string }) {
  const guests: Guest[] = [];
  for (const draft of EXAMPLE_GUESTS) {
    const response = await page.request.post(`${origin}/api/admin/guests`, {
      headers: { origin },
      data: { ...draft, faceScanRequired: false },
    });
    assert(response.ok(), `Could not create the example guest ${draft.name}.`);
    guests.push((await response.json()) as Guest);
  }
  const replies = [
    { guest: guests[0]!, status: 'accepted', companions: ['Casey Rivera'] },
    { guest: guests[1]!, status: 'accepted', companions: [] },
    { guest: guests[2]!, status: 'accepted', companions: ['Drew Chen', 'Avery Chen'] },
    { guest: guests[3]!, status: 'declined', companions: [] },
  ];
  for (const reply of replies) {
    const prefix = `${origin}/api/invitations/${reply.guest.token}`;
    const session = await page.request.post(`${prefix}/session`, { headers: { origin } });
    assert(session.ok(), 'Could not open an example invitation.');
    const saved = await page.request.put(`${prefix}/rsvp`, {
      headers: { origin },
      data: { status: reply.status, companions: reply.companions },
    });
    assert(saved.ok(), 'Could not save an example reply.');
  }
  return guests;
}
