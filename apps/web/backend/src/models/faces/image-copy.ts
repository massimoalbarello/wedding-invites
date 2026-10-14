import { z } from 'zod';
import { FACE_DESCRIPTOR_BYTES, FACE_FINGERPRINT_EDGE, MAX_FACE_IMAGE_FEATURES } from './models.ts';

// Image similarity is deliberately separate from identity similarity. A very good identity
// match is expected for a real guest and must never by itself be treated as a replay.
const DUPLICATE_NORMALIZED_RMS = 0.08;
const MIN_FINGERPRINT_DEVIATION = 10;
const PIXEL_COUNT = FACE_FINGERPRINT_EDGE ** 2;
const FingerprintSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pixels: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/),
  descriptors: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
function fingerprint(value: string) {
  try {
    const parsed = FingerprintSchema.parse(JSON.parse(value));
    const pixels = Buffer.from(parsed.pixels, 'base64');
    const descriptors = Buffer.from(parsed.descriptors, 'base64');
    if (
      descriptors.length > MAX_FACE_IMAGE_FEATURES * FACE_DESCRIPTOR_BYTES ||
      descriptors.length % FACE_DESCRIPTOR_BYTES !== 0
    ) {
      return null;
    }
    return pixels.length === PIXEL_COUNT ? { sha256: parsed.sha256, pixels, descriptors } : null;
  } catch {
    return null;
  }
}

function normalizedPixels(pixels: Uint8Array): number[] | null {
  let sum = 0;
  for (const value of pixels) {
    sum += value;
  }
  const mean = sum / PIXEL_COUNT;
  const centered = Array.from(pixels, (value) => value - mean);
  let variance = 0;
  for (const value of centered) {
    variance += value * value;
  }
  const deviation = Math.sqrt(variance / PIXEL_COUNT);
  if (deviation < MIN_FINGERPRINT_DEVIATION) {
    return null;
  }
  return centered.map((value) => value / deviation);
}

export function duplicateImage({ first, second }: { first: string; second: string }): boolean {
  const a = fingerprint(first);
  const b = fingerprint(second);
  if (!a || !b) {
    return false;
  }
  if (a.sha256 === b.sha256) {
    return true;
  }
  if (matchingTexture({ left: a.descriptors, right: b.descriptors })) {
    return true;
  }
  const left = normalizedPixels(a.pixels);
  const right = normalizedPixels(b.pixels);
  if (!left || !right) {
    return false;
  }
  let squared = 0;
  for (const [index, value] of left.entries()) {
    squared += (value - right[index]!) ** 2;
  }
  return Math.sqrt(squared / PIXEL_COUNT) <= DUPLICATE_NORMALIZED_RMS;
}

const MAX_DESCRIPTOR_DISTANCE = 32;
const NEAREST_NEIGHBOR_RATIO = 0.7;
const MIN_FEATURE_MATCHES = 12;
const MIN_MATCHED_FRACTION = 0.25;

function hammingDistance({ left, right }: { left: Uint8Array; right: Uint8Array }): number {
  let distance = 0;
  for (let index = 0; index < FACE_DESCRIPTOR_BYTES; index++) {
    let difference = left[index]! ^ right[index]!;
    while (difference) {
      difference &= difference - 1;
      distance++;
    }
  }
  return distance;
}

function nearestFeature({
  feature,
  candidates,
}: {
  feature: Uint8Array;
  candidates: Uint8Array[];
}): number | null {
  let nearest = Infinity;
  let second = Infinity;
  let bestIndex = -1;
  for (const [index, candidate] of candidates.entries()) {
    const distance = hammingDistance({ left: feature, right: candidate });
    if (distance < nearest) {
      second = nearest;
      nearest = distance;
      bestIndex = index;
    } else if (distance < second) {
      second = distance;
    }
  }
  return nearest <= MAX_DESCRIPTOR_DISTANCE && nearest < second * NEAREST_NEIGHBOR_RATIO
    ? bestIndex
    : null;
}

function features(bytes: Uint8Array): Uint8Array[] {
  const result = [];
  for (let start = 0; start < bytes.length; start += FACE_DESCRIPTOR_BYTES) {
    result.push(bytes.subarray(start, start + FACE_DESCRIPTOR_BYTES));
  }
  return result;
}

function matchingTexture({ left, right }: { left: Uint8Array; right: Uint8Array }): boolean {
  const reference = features(left);
  const capture = features(right);
  if (Math.min(reference.length, capture.length) < MIN_FEATURE_MATCHES) {
    return false;
  }
  const matches = new Set<number>();
  for (const feature of reference) {
    const nearest = nearestFeature({ feature, candidates: capture });
    if (nearest !== null) {
      matches.add(nearest);
    }
  }
  return (
    matches.size >= MIN_FEATURE_MATCHES &&
    matches.size / Math.min(reference.length, capture.length) >= MIN_MATCHED_FRACTION
  );
}
