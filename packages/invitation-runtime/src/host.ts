import type { z } from 'zod';
import { BRIDGE_CHANNEL, type InvitationRuntime, RequestSchema } from './contract';

async function invoke(input: {
  request: z.infer<typeof RequestSchema>;
  runtime: InvitationRuntime;
}) {
  try {
    const result =
      input.request.method === 'getContext'
        ? await input.runtime.getContext()
        : await input.runtime.saveRsvp(input.request.reply);
    return { result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Your request could not be completed.',
    };
  }
}

export function connectInvitationHost(input: {
  window: Window;
  frame: HTMLIFrameElement;
  runtime: InvitationRuntime;
}) {
  let connected = true;
  const receive = async (event: MessageEvent) => {
    if (
      event.source !== input.frame.contentWindow ||
      event.origin !== input.window.location.origin
    ) {
      return;
    }
    const request = RequestSchema.safeParse(event.data);
    if (!request.success) {
      return;
    }
    const response = await invoke({ request: request.data, runtime: input.runtime });
    if (connected) {
      input.frame.contentWindow?.postMessage(
        { channel: BRIDGE_CHANNEL, id: request.data.id, ...response },
        event.origin,
      );
    }
  };
  const listener = (event: MessageEvent) => {
    void receive(event);
  };
  input.window.addEventListener('message', listener);
  return () => {
    connected = false;
    input.window.removeEventListener('message', listener);
  };
}
