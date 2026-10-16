import { t } from 'elysia';
import {
  DEFAULT_PAGE_SIZE,
  MAX_COMPANIONS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GUEST_NAME_LENGTH,
  MAX_PAGE_SIZE,
  MAX_PHOTO_BYTES,
  MAX_REFERENCE_PHOTOS,
  RSVP_STATUSES,
} from '#backend/models/invitations/model.ts';
export const PublicIdSchema = t.String({ pattern: '^[a-f0-9]{48}$' });
export const GuestPublicIdSchema = t.String({ format: 'uuid' });
export const GuestParamsSchema = t.Object({ id: GuestPublicIdSchema });
export const PhotoParamsSchema = t.Object({ id: GuestPublicIdSchema, photoId: PublicIdSchema });
export const CaptureParamsSchema = t.Object({ id: GuestPublicIdSchema, captureId: PublicIdSchema });
export const CaptureListQuerySchema = t.Object({
  cursor: t.Optional(PublicIdSchema),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })),
});
export const CaptureListSchema = t.Object({
  items: t.Array(
    t.Object({ id: PublicIdSchema, createdAt: t.String(), authorized: t.Nullable(t.Boolean()) }),
  ),
  nextCursor: t.Nullable(PublicIdSchema),
});
const [pending, accepted, declined] = RSVP_STATUSES;
export const RsvpStatusSchema = t.Union([
  t.Literal(pending),
  t.Literal(accepted),
  t.Literal(declined),
]);
export const CompanionSchema = t.Object({ id: PublicIdSchema, name: t.String() });
export const GuestSettingsSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: MAX_GUEST_NAME_LENGTH }),
  groupName: t.String({ maxLength: MAX_GROUP_NAME_LENGTH, default: '' }),
  maxGuests: t.Integer({ minimum: 0, maximum: MAX_COMPANIONS, default: 0 }),
});
const GuestPhotosSchema = t.Optional(
  t.Files({ maxSize: MAX_PHOTO_BYTES, maxItems: MAX_REFERENCE_PHOTOS }),
);
export const CreateGuestSchema = t.Object({
  ...GuestSettingsSchema.properties,
  photos: GuestPhotosSchema,
});
export const EditGuestSchema = t.Object({
  ...GuestSettingsSchema.properties,
  photos: GuestPhotosSchema,
  removedPhotoIds: t.Optional(
    t.ArrayQuery(PublicIdSchema, { maxItems: MAX_REFERENCE_PHOTOS, uniqueItems: true }),
  ),
});
export const GuestSchema = t.Object({
  id: GuestPublicIdSchema,
  name: t.String(),
  groupName: t.String(),
  faceScanRequired: t.Boolean(),
  maxGuests: t.Number(),
  status: RsvpStatusSchema,
  active: t.Boolean(),
  token: PublicIdSchema,
  createdAt: t.String(),
  companions: t.Array(CompanionSchema),
  references: t.Array(t.Object({ id: PublicIdSchema, createdAt: t.String() })),
  activity: t.Object({
    linkOpenedAt: t.Nullable(t.String()),
    verificationFailedAt: t.Nullable(t.String()),
    verifiedAt: t.Nullable(t.String()),
    invitationOpenedAt: t.Nullable(t.String()),
  }),
});
export const GuestListQuerySchema = t.Object({
  order: t.Optional(t.Literal('group')),
  cursor: t.Optional(GuestPublicIdSchema),
  search: t.Optional(t.String({ maxLength: MAX_GUEST_NAME_LENGTH })),
  group: t.Optional(t.String({ maxLength: MAX_GROUP_NAME_LENGTH })),
  status: t.Optional(RsvpStatusSchema),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })),
});
export const PhotoUploadSchema = t.Object({ photo: t.File({ maxSize: MAX_PHOTO_BYTES }) });
export const StatsSchema = t.Object({
  invited: t.Number(),
  accepted: t.Number(),
  declined: t.Number(),
  pending: t.Number(),
  companions: t.Number(),
  attending: t.Number(),
});
