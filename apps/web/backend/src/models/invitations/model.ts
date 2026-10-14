import {
  MAX_ADDITIONAL_GUESTS,
  MAX_NAME_LENGTH,
  RSVP_STATUSES as runtimeStatuses,
} from '@repo/invitation-runtime/contract';

export const RSVP_STATUSES = runtimeStatuses;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const MAX_GUEST_NAME_LENGTH = MAX_NAME_LENGTH;
export const MAX_GROUP_NAME_LENGTH = 80;
export const MAX_COMPANIONS = MAX_ADDITIONAL_GUESTS;
export const MAX_REFERENCE_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8_388_608;
export const DEFAULT_PAGE_SIZE = 40;
export const MAX_PAGE_SIZE = 100;
export const SESSION_MAX_AGE_SECONDS = 7_776_000;
export const MILLISECONDS_PER_SECOND = 1000;
export type GuestSettings = {
  name: string;
  groupName: string;
  maxGuests: number;
};
export type Companion = { id: string; name: string };
export type ReferencePhoto = { id: string; createdAt: string };
export type Guest = GuestSettings & {
  id: string;
  publicId: string;
  ownerId: string;
  token: string;
  status: RsvpStatus;
  active: boolean;
  createdAt: string;
  companions: Companion[];
  references: ReferencePhoto[];
};
export type GuestListInput = {
  order?: 'group';
  cursor?: string;
  search?: string;
  group?: string;
  status?: RsvpStatus;
  limit: number;
};
export type InvitationStats = {
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
  companions: number;
  attending: number;
};
