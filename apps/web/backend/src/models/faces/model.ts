import { z } from 'zod';
import { FACE_DIMENSIONS, FACE_MODEL_VERSION } from './models.ts';

export const MAX_FACE_IMAGE_BYTES = 8_388_608;

const MAX_FINGERPRINT_LENGTH = 8192;

export const FaceObservationSchema = z.object({
  modelVersion: z.literal(FACE_MODEL_VERSION),
  embedding: z.array(z.number().finite()).length(FACE_DIMENSIONS),
  fingerprint: z.string().max(MAX_FINGERPRINT_LENGTH),
});
export type FaceObservation = z.infer<typeof FaceObservationSchema>;
