import { z } from 'zod';

export const MAX_COUPLE_NAMES_LENGTH = 120;
export const WeddingSettingsValidation = z.object({
  coupleNames: z.string().trim().min(1).max(MAX_COUPLE_NAMES_LENGTH),
  date: z.iso.date(),
});
export type WeddingSettings = z.infer<typeof WeddingSettingsValidation>;
