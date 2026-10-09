import { describe, expect, test } from 'bun:test';
import { compareFace } from '#backend/models/faces/comparison.ts';
import type { FaceObservation } from '#backend/models/faces/model.ts';
import {
  FACE_DIMENSIONS,
  FACE_FINGERPRINT_EDGE,
  FACE_MODEL_VERSION,
} from '#backend/models/faces/models.ts';

function observation({
  identity = 0,
  fingerprint = '',
}: {
  identity?: number;
  fingerprint?: string;
} = {}): FaceObservation {
  const embedding = Array<number>(FACE_DIMENSIONS).fill(0);
  embedding[identity] = 1;
  return {
    modelVersion: FACE_MODEL_VERSION,
    embedding,
    fingerprint,
  };
}

describe('face comparison trust boundary', () => {
  test('a perfect identity match is allowed when the image is different', () => {
    const reference = observation({ fingerprint: 'a different image' });
    const capture = observation({ fingerprint: 'a fresh picture of the same person' });
    expect(compareFace({ reference, capture })).toBe('match');
  });

  test('rejects a different identity and malformed or incompatible vectors', () => {
    const reference = observation();
    expect(compareFace({ reference, capture: observation({ identity: 1 }) })).toBe('no_match');
    expect(compareFace({ reference, capture: { ...reference, embedding: [1] } })).toBe('no_match');
    expect(
      compareFace({
        reference,
        capture: { ...reference, embedding: Array(FACE_DIMENSIONS).fill(0) },
      }),
    ).toBe('no_match');
    expect(
      compareFace({
        reference,
        capture: { ...reference, embedding: Array(FACE_DIMENSIONS).fill(Number.NaN) },
      }),
    ).toBe('no_match');
  });

  test('rejects exact image reuse independently of the identity vector', () => {
    const fingerprint = JSON.stringify({
      sha256: new Bun.CryptoHasher('sha256').update('reference image').digest('hex'),
      pixels: Buffer.alloc(FACE_FINGERPRINT_EDGE ** 2).toString('base64'),
      descriptors: '',
    });
    expect(
      compareFace({
        reference: observation({ fingerprint }),
        capture: observation({ fingerprint }),
      }),
    ).toBe('duplicate');
  });
});
