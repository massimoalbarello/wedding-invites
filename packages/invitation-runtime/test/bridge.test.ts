import { expect, test } from 'bun:test';
import { createInvitationClient } from '../src/client';
import { BRIDGE_CHANNEL, type InvitationContext, type InvitationRuntime } from '../src/contract';
import { connectInvitationHost } from '../src/host';

const ORIGIN = 'https://invite.test';
function message(input: { data: unknown; origin: string; source: Window }) {
  return Object.assign(new Event('message'), input);
}
const context: InvitationContext = {
  recipient: { name: 'Alex' },
  rsvp: { status: 'pending', companions: [], maxAdditionalGuests: 1 },
};
function fixture(runtime: InvitationRuntime) {
  const host = Object.assign(new EventTarget(), {
    location: { origin: ORIGIN },
  }) as unknown as Window;
  const child = Object.assign(new EventTarget(), {
    location: { origin: ORIGIN },
    parent: host,
  }) as unknown as Window;
  host.postMessage = (data: unknown) =>
    host.dispatchEvent(message({ data, origin: ORIGIN, source: child }));
  child.postMessage = (data: unknown) =>
    child.dispatchEvent(message({ data, origin: ORIGIN, source: host }));
  const frame = { contentWindow: child } as HTMLIFrameElement;
  return {
    host,
    child,
    disconnect: connectInvitationHost({ window: host, frame, runtime }),
    client: createInvitationClient({ window: child }),
  };
}

test('the two-method interface exchanges context, saved state, and application failures', async () => {
  const f = fixture({
    getContext: () => Promise.resolve(context),
    saveRsvp: (reply) =>
      reply.companions.length > context.rsvp.maxAdditionalGuests
        ? Promise.reject(new Error('This invitation does not allow that many guests.'))
        : Promise.resolve({ ...context.rsvp, ...reply }),
  });
  try {
    expect(await f.client.getContext()).toEqual(context);
    expect(await f.client.saveRsvp({ status: 'accepted', companions: ['Sam'] })).toEqual({
      status: 'accepted',
      companions: ['Sam'],
      maxAdditionalGuests: 1,
    });
    await expect(
      f.client.saveRsvp({ status: 'accepted', companions: ['One', 'Two'] }),
    ).rejects.toThrow('does not allow');
  } finally {
    f.disconnect();
  }
});

test('the host ignores other windows, other origins, malformed commands, and messages after disconnect', async () => {
  let calls = 0;
  const f = fixture({
    getContext: () => {
      calls++;
      return Promise.resolve(context);
    },
    saveRsvp: () => Promise.resolve(context.rsvp),
  });
  const data = { channel: BRIDGE_CHANNEL, id: crypto.randomUUID(), method: 'getContext' };
  try {
    f.host.dispatchEvent(message({ data, origin: 'https://other.test', source: f.child }));
    f.host.dispatchEvent(message({ data, origin: ORIGIN, source: f.host }));
    f.host.dispatchEvent(
      message({
        data: { ...data, method: 'deleteGuest' },
        origin: ORIGIN,
        source: f.child,
      }),
    );
    expect(calls).toBe(0);
    expect(await f.client.getContext()).toEqual(context);
    expect(calls).toBe(1);
    f.disconnect();
    f.host.dispatchEvent(message({ data, origin: ORIGIN, source: f.child }));
    expect(calls).toBe(1);
  } finally {
    f.disconnect();
  }
});
