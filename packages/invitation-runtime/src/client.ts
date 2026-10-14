import {
  BRIDGE_CHANNEL,
  InvitationContextSchema,
  type InvitationRuntime,
  ResponseSchema,
  type RsvpReply,
  RsvpReplySchema,
  RsvpStateSchema,
} from './contract';

const REQUEST_TIMEOUT_MS = 30_000;

export function createInvitationClient(input: { window: Window }): InvitationRuntime {
  const target = input.window;
  const request = (value: { method: 'getContext' } | { method: 'saveRsvp'; reply: RsvpReply }) =>
    // biome-ignore lint/complexity/useMaxParams: native Promise executor signature.
    new Promise<unknown>((resolve, reject) => {
      if (target.parent === target) {
        reject(new Error('Open this invitation through your personal link.'));
        return;
      }
      const id = crypto.randomUUID();
      const cleanup = () => {
        clearTimeout(timer);
        target.removeEventListener('message', receive);
      };
      const receive = (event: MessageEvent) => {
        if (event.source !== target.parent || event.origin !== target.location.origin) {
          return;
        }
        const response = ResponseSchema.safeParse(event.data);
        if (!response.success || response.data.id !== id) {
          return;
        }
        cleanup();
        if (response.data.error) {
          reject(new Error(response.data.error));
        } else {
          resolve(response.data.result);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error('The invitation could not connect. Please open your personal link again.'),
        );
      }, REQUEST_TIMEOUT_MS);
      target.addEventListener('message', receive);
      target.parent.postMessage({ channel: BRIDGE_CHANNEL, id, ...value }, target.location.origin);
    });
  return {
    getContext: async () => InvitationContextSchema.parse(await request({ method: 'getContext' })),
    saveRsvp: async (reply) =>
      RsvpStateSchema.parse(
        await request({ method: 'saveRsvp', reply: RsvpReplySchema.parse(reply) }),
      ),
  };
}
