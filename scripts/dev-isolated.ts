import { virtualPasskeyBrowser } from '@repo/browser-testing/browser';
import { startIsolatedApp } from './isolated-app';
import { seedGuests } from './seed-guests';
import { seedWedding } from './seed-wedding';

const app = await startIsolatedApp();
let browser: Awaited<ReturnType<typeof virtualPasskeyBrowser>> | undefined;
const stop = () => app.child.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  browser = await virtualPasskeyBrowser({ headless: false });
  await browser.page.goto(app.origin);
  if (Bun.argv.includes('--seed')) {
    await browser.page.getByRole('button', { name: 'Create dashboard with a passkey' }).click();
    await browser.page.getByRole('heading', { name: 'Guest list', exact: true }).waitFor();
    await seedWedding({ page: browser.page, origin: app.origin });
    await seedGuests({ page: browser.page, origin: app.origin });
    await browser.page.reload();
    await browser.page.getByText('Alex Rivera', { exact: true }).waitFor();
  }
  console.log(`Isolated application: ${app.origin} (data: ${app.dataFolder})`);
  await app.child.exited;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  try {
    await browser?.close();
  } finally {
    await app.stop();
  }
}
