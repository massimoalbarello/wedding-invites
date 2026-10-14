import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Subprocess } from 'bun';
import { z } from 'zod';
import { FaceAnalysisError } from '../../lib/faces/errors.ts';
import type { FaceObservation } from '../../models/faces/model.ts';
import { MAX_FACE_IMAGE_BYTES } from '../../models/faces/model.ts';
import {
  FACE_DESCRIPTOR_BYTES,
  FACE_DIMENSIONS,
  FACE_FINGERPRINT_EDGE,
  FACE_MODEL_VERSION,
  MAX_FACE_IMAGE_FEATURES,
} from '../../models/faces/models.ts';
import type { FaceAnalyzer } from './analyzer.ts';
import { type FaceRuntime, prepareFaceRuntime } from './runtime.ts';

const OWNER_DIRECTORY_MODE = 0o700;
const OWNER_FILE_MODE = 0o600;
const JPEG_START = 0xff;
const JPEG_MARKER = 0xd8;
const PNG_START = 0x89;
const PNG_END = 4;
const WEBP_START = 8;
const WEBP_END = 12;
const PROCESS_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 65_536;
const MAX_DECODED_PIXELS = 16_000_000;
const MAX_PIXEL_VALUE = 255;
const NativeResultSchema = z.object({
  descriptors: z
    .array(z.number().int().min(0).max(MAX_PIXEL_VALUE))
    .max(FACE_DESCRIPTOR_BYTES * MAX_FACE_IMAGE_FEATURES)
    .refine((value) => value.length % FACE_DESCRIPTOR_BYTES === 0),
  embedding: z.array(z.number().finite()).length(FACE_DIMENSIONS),
  pixels: z.array(z.number().int().min(0).max(MAX_PIXEL_VALUE)).length(FACE_FINGERPRINT_EDGE ** 2),
});
const errorMessages = {
  no_face: 'We could not find a face. Face the camera and try again.',
  multiple_faces: 'Please use a picture with just one person in it.',
  small_face: 'Move a little closer so your face is clear, then try again.',
  invalid_image: 'Please use a clear JPEG, PNG, or WebP photo under 8 MB and 16 megapixels.',
} as const;

function supportedImage(image: Uint8Array): boolean {
  return (
    (image[0] === JPEG_START && image[1] === JPEG_MARKER && image[2] === JPEG_START) ||
    (image[0] === PNG_START && new TextDecoder().decode(image.slice(1, PNG_END)) === 'PNG') ||
    (new TextDecoder().decode(image.slice(0, PNG_END)) === 'RIFF' &&
      new TextDecoder().decode(image.slice(WEBP_START, WEBP_END)) === 'WEBP')
  );
}

function parseResult(output: string) {
  const value: unknown = JSON.parse(output);
  if (typeof value === 'object' && value && 'error' in value) {
    const code =
      typeof value.error === 'string' && Object.hasOwn(errorMessages, value.error)
        ? (value.error as keyof typeof errorMessages)
        : 'invalid_image';
    throw new FaceAnalysisError({ message: errorMessages[code], code: code });
  }
  const parsed = NativeResultSchema.parse(value);
  if (!parsed.embedding.some((number) => number !== 0)) {
    throw new FaceAnalysisError({
      message: 'Please try another clear picture.',
      code: 'invalid_image',
    });
  }
  return parsed;
}

/** Stateless inference children release model memory after every image on the 512 MiB host. */
class LocalFaceAnalyzer implements FaceAnalyzer {
  private readonly directory: string;
  private preparation: Promise<FaceRuntime> | null = null;
  private active: Promise<FaceObservation> | null = null;
  private child: Subprocess<'ignore', 'pipe', 'inherit'> | null = null;
  private closed = false;

  constructor({ dataFolder }: { dataFolder: string }) {
    this.directory = join(dataFolder, 'runtime', 'faces');
  }

  analyze(input: { ownerId: string; image: Uint8Array }): Promise<FaceObservation> {
    if (this.closed) {
      return Promise.reject(
        new FaceAnalysisError({
          message: 'Face recognition is unavailable. Please try again shortly.',
          code: 'unavailable',
        }),
      );
    }
    if (this.active) {
      return Promise.reject(
        new FaceAnalysisError({
          message: 'Someone else is being checked. Please try again in a moment.',
          code: 'busy',
        }),
      );
    }
    if (
      !input.ownerId ||
      !input.image.length ||
      input.image.length > MAX_FACE_IMAGE_BYTES ||
      !supportedImage(input.image)
    ) {
      return Promise.reject(
        new FaceAnalysisError({ message: errorMessages.invalid_image, code: 'invalid_image' }),
      );
    }
    this.active = this.processImage(input).finally(() => {
      this.active = null;
    });
    return this.active;
  }

  private runtime(): Promise<FaceRuntime> {
    this.preparation ??= prepareFaceRuntime(this.directory).catch((error: unknown) => {
      this.preparation = null;
      throw error;
    });
    return this.preparation;
  }

  private async processImage({
    ownerId,
    image,
  }: {
    ownerId: string;
    image: Uint8Array;
  }): Promise<FaceObservation> {
    let workspace: string | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const runtime = await this.runtime();
      if (this.closed) {
        throw new FaceAnalysisError({
          message: 'Face recognition is unavailable.',
          code: 'unavailable',
        });
      }
      const ownerDirectory = join(
        this.directory,
        new Bun.CryptoHasher('sha256').update(ownerId).digest('hex'),
      );
      await mkdir(ownerDirectory, { recursive: true, mode: OWNER_DIRECTORY_MODE });
      workspace = await mkdtemp(join(ownerDirectory, 'capture-'));
      const imagePath = join(workspace, 'image');
      await Bun.write(imagePath, image, { mode: OWNER_FILE_MODE });
      Bun.gc(true);
      const child = Bun.spawn([runtime.binary, runtime.detector, runtime.recognizer, imagePath], {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'inherit',
        env: {
          ...process.env,
          OPENCV_IO_MAX_IMAGE_PIXELS: String(MAX_DECODED_PIXELS),
          OPENCV_LOG_LEVEL: 'ERROR',
        },
      });
      this.child = child;
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, PROCESS_TIMEOUT_MS);
      if (process.platform === 'linux') {
        await Bun.write(`/proc/${child.pid}/oom_score_adj`, '1000').catch(() => undefined);
      }
      let output = '';
      for await (const chunk of child.stdout) {
        output += new TextDecoder().decode(chunk);
        if (output.length > MAX_RESPONSE_BYTES) {
          throw new FaceAnalysisError({
            message: 'Face recognition returned an invalid result. Please try again.',
            code: 'unavailable',
          });
        }
      }
      if ((await child.exited) !== 0) {
        throw new FaceAnalysisError({
          message: timedOut
            ? 'That took too long. Please try another picture.'
            : 'Face recognition is unavailable. Please try again shortly.',
          code: 'unavailable',
        });
      }
      const parsed = parseResult(output);
      return {
        embedding: parsed.embedding,
        modelVersion: FACE_MODEL_VERSION,
        fingerprint: JSON.stringify({
          sha256: new Bun.CryptoHasher('sha256').update(image).digest('hex'),
          pixels: Buffer.from(parsed.pixels).toString('base64'),
          descriptors: Buffer.from(parsed.descriptors).toString('base64'),
        }),
      };
    } catch (error) {
      if (error instanceof FaceAnalysisError) {
        throw error;
      }
      throw new FaceAnalysisError({
        message: 'Face recognition is unavailable. Please try again shortly.',
        code: 'unavailable',
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      const child = this.child;
      this.child = null;
      if (child) {
        child.kill();
        await child.exited;
      }
      if (workspace) {
        await rm(workspace, { recursive: true, force: true });
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.child?.kill('SIGKILL');
    await Promise.allSettled([this.preparation, this.active]);
  }
}

export function createLocalFaceAnalyzer(options: {
  dataFolder: string;
}): FaceAnalyzer & { close(): Promise<void> } {
  return new LocalFaceAnalyzer(options);
}
