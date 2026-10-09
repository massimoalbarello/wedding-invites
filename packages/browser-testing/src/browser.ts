import { chromium } from 'playwright';
import { enableVirtualPasskey } from './auth';
export async function virtualPasskeyBrowser(input: { headless: boolean; cameraFile?: string }) {
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
    const context = await browser.newContext();
    const page = await context.newPage();
    await enableVirtualPasskey(page);
    return { page, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
