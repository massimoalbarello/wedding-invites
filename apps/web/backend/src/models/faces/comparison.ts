import { duplicateImage } from './image-copy.ts';
import type { FaceObservation } from './model.ts';
import { FACE_DIMENSIONS, FACE_MODEL_VERSION } from './models.ts';

const MATCH_THRESHOLD = 0.363;
/** A conservative image-duplicate heuristic; it does not establish camera liveness. */
export function compareFace({
  reference,
  capture,
}: {
  reference: FaceObservation;
  capture: FaceObservation;
}): 'match' | 'no_match' | 'duplicate' {
  if (
    reference.modelVersion !== FACE_MODEL_VERSION ||
    capture.modelVersion !== FACE_MODEL_VERSION
  ) {
    return 'no_match';
  }
  if (duplicateImage({ first: reference.fingerprint, second: capture.fingerprint })) {
    return 'duplicate';
  }
  if (
    reference.embedding.length !== FACE_DIMENSIONS ||
    capture.embedding.length !== FACE_DIMENSIONS
  ) {
    return 'no_match';
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < FACE_DIMENSIONS; index++) {
    const left = reference.embedding[index]!;
    const right = capture.embedding[index]!;
    dot += left * right;
    leftNorm += left * left;
    rightNorm += right * right;
  }
  const similarity = dot / Math.sqrt(leftNorm * rightNorm);
  return Number.isFinite(similarity) && similarity >= MATCH_THRESHOLD ? 'match' : 'no_match';
}
