import { expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compareFace } from '../backend/src/models/faces/comparison.ts';
import { FaceObservationSchema } from '../backend/src/models/faces/model.ts';
import { createLocalFaceAnalyzer } from '../backend/src/repositories/faces/local-analyzer.ts';

const fixtures = resolve(import.meta.dir, '../backend/test/fixtures/faces');
const assets = resolve(import.meta.dir, '../.cache/face-runtime-host/face-engine');
const MAX_TEST_RUNTIME_MS = 60_000;

test(
  'packaged analyzer recognizes a distinct photo and rejects strangers, copies, and multiple faces',
  async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'wedding-face-binary-'));
    try {
      const harness = join(workspace, 'main.ts');
      const binary = join(workspace, 'analyze');
      const adapter = resolve(
        import.meta.dir,
        '../backend/src/repositories/faces/local-analyzer.ts',
      );
      await Bun.write(
        harness,
        `import { createLocalFaceAnalyzer } from ${JSON.stringify(adapter)};
const analyzer = createLocalFaceAnalyzer({ dataFolder: Bun.argv[3] });
try {
  const value = await analyzer.analyze({ ownerId: 'test-owner', image: await Bun.file(Bun.argv[2]).bytes() });
  console.log(JSON.stringify(value));
} catch (error) {
  console.log(JSON.stringify({ error: error.code }));
} finally { await analyzer.close(); }
`,
      );
      const build = await Bun.build({
        entrypoints: [harness],
        compile: { outfile: binary, assets: [assets] },
        naming: { asset: '[dir]/[name].[ext]' },
        target: 'bun',
      });
      if (!build.success) {
        throw new AggregateError(build.logs, 'Native test executable did not compile');
      }
      async function analyze(name: string): Promise<unknown> {
        const child = Bun.spawn([binary, join(fixtures, name), join(workspace, 'data')], {
          cwd: workspace,
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const [output, errors, exit] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect(exit, errors).toBe(0);
        return JSON.parse(output);
      }
      const reference = FaceObservationSchema.parse(await analyze('reference.jpg'));
      const genuine = FaceObservationSchema.parse(await analyze('same-person.jpg'));
      const stranger = FaceObservationSchema.parse(await analyze('different-person.jpg'));
      const copy = FaceObservationSchema.parse(await analyze('reference-reencoded.jpg'));
      expect(compareFace({ reference, capture: genuine })).toBe('match');
      expect(compareFace({ reference, capture: stranger })).toBe('no_match');
      expect(compareFace({ reference, capture: reference })).toBe('duplicate');
      expect(compareFace({ reference, capture: copy })).toBe('duplicate');
      expect(await analyze('multiple-people.jpg')).toEqual({ error: 'multiple_faces' });
      const runtimeFiles = await readdir(join(workspace, 'data/runtime/faces'), {
        recursive: true,
      });
      expect(runtimeFiles.filter((path) => path.includes('capture-'))).toEqual([]);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  },
  MAX_TEST_RUNTIME_MS,
);

test(
  'limits local inference to one image and releases the slot after completion',
  async () => {
    const dataFolder = await mkdtemp(join(tmpdir(), 'wedding-face-concurrency-'));
    const analyzer = createLocalFaceAnalyzer({ dataFolder });
    try {
      const image = await Bun.file(join(fixtures, 'reference.jpg')).bytes();
      const processing = analyzer.analyze({ ownerId: 'owner-one', image });
      await expect(analyzer.analyze({ ownerId: 'owner-two', image })).rejects.toMatchObject({
        code: 'busy',
      });
      await processing;
      expect(
        FaceObservationSchema.safeParse(await analyzer.analyze({ ownerId: 'owner-two', image }))
          .success,
      ).toBe(true);
    } finally {
      await analyzer.close();
      await rm(dataFolder, { recursive: true, force: true });
    }
  },
  MAX_TEST_RUNTIME_MS,
);
