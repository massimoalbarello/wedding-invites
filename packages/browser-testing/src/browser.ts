import { type BrowserContextOptions, chromium } from 'playwright';
import { enableVirtualPasskey } from './auth';
export async function virtualPasskeyBrowser(input: {
  headless: boolean;
  cameraFile?: string;
  recordVideo?: BrowserContextOptions['recordVideo'];
}) {
  const browser = await chromium.launch({
    headless: input.headless,
    handleSIGINT: false,
    handleSIGTERM: false,
    args: input.cameraFile
      ? [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          `--use-file-for-fake-video-capture=${input.cameraFile}`,
        ]
      : [],
  });
  try {
    const context = await browser.newContext({ recordVideo: input.recordVideo });
    const page = await context.newPage();
    await enableVirtualPasskey(page);
    return { page, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
