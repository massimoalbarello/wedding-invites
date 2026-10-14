import type { FaceObservation } from '../../models/faces/model.ts';

export interface FaceAnalyzer {
  analyze(input: { ownerId: string; image: Uint8Array }): Promise<FaceObservation>;
}
