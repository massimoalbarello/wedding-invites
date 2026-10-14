import { chmod, cp, mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { FACE_MODEL_FILES } from '../backend/src/models/faces/models.ts';

const MODEL_DOWNLOAD_TIMEOUT_MS = 120_000;
const BUILD_PROGRESS_INTERVAL_MS = 15_000;
const FAILURE_LOG_BYTES = 4096;
const OWNER_EXECUTABLE_MODE = 0o700;

const app = resolve(import.meta.dir, '..');
const root = resolve(app, '../..');

async function checksum(file: Blob) {
  const hash = new Bun.CryptoHasher('sha256');
  for await (const bytes of file.stream()) {
    hash.update(bytes);
  }
  return hash.digest('hex');
}

async function prepareModels(directory: string) {
  for (const model of FACE_MODEL_FILES) {
    const destination = join(directory, model.name);
    const existing = Bun.file(destination);
    if (
      (await existing.exists()) &&
      existing.size <= model.maximumBytes &&
      (await checksum(existing)) === model.sha256
    ) {
      continue;
    }
    const temporary = `${destination}.${Bun.randomUUIDv7()}.tmp`;
    const response = await fetch(model.url, {
      signal: AbortSignal.timeout(MODEL_DOWNLOAD_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!response.ok || !response.body) {
      throw new Error(`Could not download ${model.name}: ${response.status}`);
    }
    const writer = Bun.file(temporary).writer();
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > model.maximumBytes) {
          throw new Error(`${model.name} exceeds its size limit`);
        }
        writer.write(chunk);
        await writer.flush();
      }
      await writer.end();
      if ((await checksum(Bun.file(temporary))) !== model.sha256) {
        throw new Error(`${model.name} failed its SHA-256 check`);
      }
      await rename(temporary, destination);
    } finally {
      await writer.end();
      await rm(temporary, { force: true });
    }
  }
}

export async function buildFaceRuntime({
  linux = false,
}: {
  linux?: boolean;
} = {}): Promise<string> {
  const platform = linux ? 'linux' : 'host';
  const build = join(root, '.cache', `face-build-${platform}`);
  const destination = join(app, '.cache', `face-runtime-${platform}`, 'face-engine');
  await mkdir(build, { recursive: true });
  await mkdir(destination, { recursive: true });
  const logPath = join(build, 'build.log');
  const log = Bun.file(logPath).writer();
  async function run(command: string[]) {
    if (!Bun.which(command[0]!)) {
      throw new Error(
        `${command[0]} is required to build face recognition. ${linux ? 'Install and start Docker.' : 'Install CMake 3.24+ and a C++ compiler.'}`,
      );
    }
    const child = Bun.spawn(command, {
      cwd: root,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    const progress = setInterval(
      () => console.log(`Building face recognition for ${platform}; output: ${logPath}`),
      BUILD_PROGRESS_INTERVAL_MS,
    );
    async function capture(stream: ReadableStream<Uint8Array>) {
      for await (const chunk of stream) {
        log.write(chunk);
      }
    }
    try {
      const [exit] = await Promise.all([
        child.exited,
        capture(child.stdout),
        capture(child.stderr),
      ]);
      if (exit !== 0) {
        await log.flush();
        const file = Bun.file(logPath);
        throw new Error(
          `Face recognition build failed: ${await file.slice(Math.max(0, file.size - FAILURE_LOG_BYTES)).text()}\nFull output: ${logPath}`,
        );
      }
    } finally {
      clearInterval(progress);
      process.off('SIGTERM', stop);
      process.off('SIGINT', stop);
    }
  }
  console.log(
    `Preparing face recognition for ${platform}. The first build may take several minutes.`,
  );
  try {
    if (linux) {
      await run(['docker', 'info']);
      await run([
        'docker',
        'buildx',
        'build',
        '--platform',
        'linux/amd64',
        '--progress=plain',
        '-f',
        'apps/web/backend/native/faces/Dockerfile',
        '--output',
        `type=local,dest=${destination}`,
        'apps/web/backend/native/faces',
      ]);
    } else {
      await run([
        'cmake',
        '-S',
        'apps/web/backend/native/faces',
        '-B',
        build,
        '-DCMAKE_BUILD_TYPE=MinSizeRel',
      ]);
      await run(['cmake', '--build', build, '--target', 'face-analyzer', '-j2']);
      const temporary = join(destination, `face-analyzer-${Bun.randomUUIDv7()}`);
      try {
        await cp(join(build, 'runtime/face-analyzer'), temporary);
        await chmod(temporary, OWNER_EXECUTABLE_MODE);
        await rename(temporary, join(destination, 'face-analyzer'));
      } finally {
        await rm(temporary, { force: true });
      }
    }
    await prepareModels(destination);
    return destination;
  } finally {
    await log.end();
  }
}

if (import.meta.main) {
  await buildFaceRuntime({ linux: process.env.BUILD_TARGET === 'bun-linux-x64' });
}
