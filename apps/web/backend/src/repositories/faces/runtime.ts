import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BunFile } from 'bun';
import { FaceAnalysisError } from '../../lib/faces/errors.ts';
import { FACE_MODEL_FILES } from '../../models/faces/models.ts';

const OWNER_DIRECTORY_MODE = 0o700;
const OWNER_FILE_MODE = 0o600;
export type FaceRuntime = { binary: string; detector: string; recognizer: string };

async function checksum(file: Blob): Promise<string> {
  const hash = new Bun.CryptoHasher('sha256');
  for await (const bytes of file.stream()) {
    hash.update(bytes);
  }
  return hash.digest('hex');
}

async function sourceAsset(name: string): Promise<{ source: BunFile; digest: string }> {
  const source = Bun.isStandaloneExecutable
    ? (Bun.embeddedFiles as readonly BunFile[]).find((file) => file.name === `face-engine/${name}`)
    : Bun.file(resolve(import.meta.dir, '../../../../.cache/face-runtime-host/face-engine', name));
  if (!source || !(await source.exists())) {
    throw new FaceAnalysisError({
      message: 'Face recognition is temporarily unavailable. Please try again shortly.',
      code: 'unavailable',
    });
  }
  const model = FACE_MODEL_FILES.find((candidate) => candidate.name === name);
  const digest = await checksum(source);
  if (model && (source.size > model.maximumBytes || digest !== model.sha256)) {
    throw new FaceAnalysisError({
      message: 'Face recognition is temporarily unavailable. Please try again shortly.',
      code: 'unavailable',
    });
  }
  return { source, digest };
}

async function installAsset({
  name,
  directory,
}: {
  name: string;
  directory: string;
}): Promise<string> {
  const { source, digest } = await sourceAsset(name);
  if (!Bun.isStandaloneExecutable) {
    return source.name!;
  }
  const path = join(directory, `${digest}-${name}`);
  const existing = Bun.file(path);
  if (
    !(await existing.exists()) ||
    existing.size !== source.size ||
    (await checksum(existing)) !== digest
  ) {
    const temporary = `${path}.${Bun.randomUUIDv7()}.tmp`;
    try {
      await Bun.write(temporary, source);
      await chmod(temporary, name === 'face-analyzer' ? OWNER_DIRECTORY_MODE : OWNER_FILE_MODE);
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  if (name === 'face-analyzer') {
    await chmod(path, OWNER_DIRECTORY_MODE);
  }
  return path;
}

export async function prepareFaceRuntime(directory: string): Promise<FaceRuntime> {
  await mkdir(directory, { recursive: true, mode: OWNER_DIRECTORY_MODE });
  const binary = await installAsset({ name: 'face-analyzer', directory });
  const detector = await installAsset({ name: FACE_MODEL_FILES[0].name, directory });
  const recognizer = await installAsset({ name: FACE_MODEL_FILES[1].name, directory });
  return { binary, detector, recognizer };
}
