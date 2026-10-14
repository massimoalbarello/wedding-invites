import { z } from 'zod';

export const RSVP_STATUSES = ['pending', 'accepted', 'declined'] as const;
export const MAX_ADDITIONAL_GUESTS = 20;
export const MAX_NAME_LENGTH = 120;
export const RsvpReplySchema = z.object({
  status: z.enum(RSVP_STATUSES).exclude(['pending']),
  companions: z.array(z.string().min(1).max(MAX_NAME_LENGTH)).max(MAX_ADDITIONAL_GUESTS),
});
export const RsvpStateSchema = z.object({
  status: z.enum(RSVP_STATUSES),
  companions: z.array(z.string()),
  maxAdditionalGuests: z.number().int().min(0).max(MAX_ADDITIONAL_GUESTS),
});
export const InvitationContextSchema = z.object({
  recipient: z.object({ name: z.string() }),
  rsvp: RsvpStateSchema,
});
export type InvitationContext = z.infer<typeof InvitationContextSchema>;
export type RsvpState = z.infer<typeof RsvpStateSchema>;
export type RsvpReply = z.infer<typeof RsvpReplySchema>;
export interface InvitationRuntime {
  getContext(): Promise<InvitationContext>;
  saveRsvp(reply: RsvpReply): Promise<RsvpState>;
}

export const BRIDGE_CHANNEL = 'invitation-runtime/v1';
export const RequestSchema = z.discriminatedUnion('method', [
  z.object({
    channel: z.literal(BRIDGE_CHANNEL),
    id: z.string().uuid(),
    method: z.literal('getContext'),
  }),
  z.object({
    channel: z.literal(BRIDGE_CHANNEL),
    id: z.string().uuid(),
    method: z.literal('saveRsvp'),
    reply: RsvpReplySchema,
  }),
]);
export const ResponseSchema = z.object({
  channel: z.literal(BRIDGE_CHANNEL),
  id: z.string().uuid(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
