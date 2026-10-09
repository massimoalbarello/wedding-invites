import { expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_FACE_IMAGE_BYTES } from '#backend/models/faces/model.ts';
import { createLocalFaceAnalyzer } from '#backend/repositories/faces/local-analyzer.ts';

test('rejects oversized and unsupported images before acquiring a runtime, and closes permanently', async () => {
  const dataFolder = await mkdtemp(join(tmpdir(), 'wedding-face-input-'));
  const analyzer = createLocalFaceAnalyzer({ dataFolder });
  try {
    const oversized = new Uint8Array(MAX_FACE_IMAGE_BYTES + 1);
    for (const image of [new Uint8Array(), new TextEncoder().encode('<svg></svg>'), oversized]) {
      await expect(analyzer.analyze({ ownerId: 'owner', image })).rejects.toMatchObject({
        code: 'invalid_image',
      });
    }
    expect(await readdir(dataFolder)).toEqual([]);
    await analyzer.close();
    await expect(
      analyzer.analyze({ ownerId: 'owner', image: new Uint8Array() }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  } finally {
    await analyzer.close();
    await rm(dataFolder, { recursive: true, force: true });
  }
});
