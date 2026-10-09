import { t } from 'elysia';
import { MAX_COUPLE_NAMES_LENGTH } from '#backend/models/wedding/model.ts';

export const WeddingSettingsSchema = t.Object({
  coupleNames: t.String({ minLength: 1, maxLength: MAX_COUPLE_NAMES_LENGTH }),
  date: t.String({ format: 'date' }),
});
