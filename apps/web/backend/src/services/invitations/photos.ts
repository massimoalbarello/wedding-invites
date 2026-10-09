import { AppError, BadRequestError } from '#backend/lib/errors.ts';
import { FaceAnalysisError } from '#backend/lib/faces/errors.ts';
import { MAX_PHOTO_BYTES } from '#backend/models/invitations/model.ts';
import type { FaceAnalyzer } from '#backend/repositories/faces/analyzer.ts';

const JPEG_SIGNATURE = Buffer.from('ffd8ff', 'hex');
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const WEBP_CONTAINER_END = 4;
const WEBP_TYPE_OFFSET = 8;
const WEBP_TYPE_END = 12;
export async function readPhoto(photo: File) {
  if (!photo.size || photo.size > MAX_PHOTO_BYTES) {
    throw new BadRequestError('Choose a photo smaller than 8 MB.');
  }
  const image = new Uint8Array(await photo.arrayBuffer());
  let mediaType: string;
  if (JPEG_SIGNATURE.equals(image.subarray(0, JPEG_SIGNATURE.length))) {
    mediaType = 'image/jpeg';
  } else if (PNG_SIGNATURE.equals(image.subarray(0, PNG_SIGNATURE.length))) {
    mediaType = 'image/png';
  } else if (
    new TextDecoder().decode(image.subarray(0, WEBP_CONTAINER_END)) === 'RIFF' &&
    new TextDecoder().decode(image.subarray(WEBP_TYPE_OFFSET, WEBP_TYPE_END)) === 'WEBP'
  ) {
    mediaType = 'image/webp';
  } else {
    throw new BadRequestError('Use a JPEG, PNG, or WebP photo.');
  }
  return { image, mediaType };
}
export async function analyzePhoto(input: {
  faces: FaceAnalyzer;
  ownerId: string;
  image: Uint8Array;
}) {
  try {
    return await input.faces.analyze({ ownerId: input.ownerId, image: input.image });
  } catch (error) {
    if (error instanceof FaceAnalysisError) {
      if (error.code === 'busy' || error.code === 'unavailable') {
        throw new AppError({ statusCode: 503, message: error.message });
      }
      throw new BadRequestError(error.message);
    }
    throw error;
  }
}
