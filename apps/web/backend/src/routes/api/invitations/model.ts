import { t } from 'elysia';
import { MAX_COMPANIONS, MAX_GUEST_NAME_LENGTH } from '#backend/models/invitations/model.ts';
import {
  CompanionSchema,
  PublicIdSchema,
  RsvpStatusSchema,
} from '#backend/routes/api/admin/model.ts';
export const InvitationParamsSchema = t.Object({ token: PublicIdSchema });
export const InvitationEntrySchema = t.Object({
  name: t.String(),
  faceScanRequired: t.Boolean(),
  authenticated: t.Boolean(),
});
export const InvitationContentSchema = t.Object({
  name: t.String(),
  date: t.String(),
  coupleNames: t.String(),
  status: RsvpStatusSchema,
  maxGuests: t.Number(),
  companions: t.Array(CompanionSchema),
});
export const RsvpSchema = t.Object({
  status: t.Union([t.Literal('accepted'), t.Literal('declined')]),
  companions: t.Array(t.String({ minLength: 1, maxLength: MAX_GUEST_NAME_LENGTH }), {
    maxItems: MAX_COMPANIONS,
  }),
});
