import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { virtualPasskeyBrowser } from '@repo/browser-testing/browser';
import { startIsolatedApp } from './isolated-app';
import { seedGuests } from './seed-guests';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const PAGE_OVERFLOW_COUNT = 42;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 1000 };
const fixtures = resolve('apps/web/backend/test/fixtures/faces');
const artifacts = resolve('artifacts');
type TestBrowser = Awaited<ReturnType<typeof virtualPasskeyBrowser>>;
type Page = TestBrowser['page'];
type Guest = { id: string; name: string; token: string };

async function cameraVideo(name: string) {
  const destination = resolve(artifacts, `${name}.y4m`);
  // The independent portrait is a stage photograph; frame the face like a phone selfie.
  const crop = name === 'same-person' ? 'crop=1000:1000:1500:400,' : '';
  const child = Bun.spawn(
    [
      'ffmpeg',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-loop',
      '1',
      '-i',
      resolve(fixtures, `${name}.jpg`),
      '-t',
      '1',
      '-r',
      '1',
      '-vf',
      `${crop}scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
      '-f',
      'yuv4mpegpipe',
      destination,
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  assert.equal(await child.exited, 0, 'Could not generate the disposable camera fixture.');
  return destination;
}

async function captureSelfie(page: Page) {
  await page.getByRole('button', { name: 'Take a selfie', exact: true }).click();
  await page.getByRole('button', { name: 'Capture photo', exact: true }).click();
  await page.getByRole('img', { name: 'Your captured selfie' }).waitFor();
  await page.getByRole('button', { name: 'Use this photo', exact: true }).click();
}

async function createGuestInDashboard(page: Page) {
  await page.getByRole('link', { name: 'Add guest' }).click();
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Full name', { exact: true }).fill('Taylor Reed');
  await page.getByLabel('Group (optional)', { exact: true }).fill('Friends');
  await page.getByLabel('Additional guests allowed', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('heading', { name: 'Taylor Reed', exact: true }).waitFor();
  await page
    .getByLabel('Upload reference photos', { exact: true })
    .setInputFiles(resolve(fixtures, 'reference.jpg'));
  await page.getByRole('img', { name: 'Reference 1 for Taylor Reed', exact: true }).waitFor();
  const link = await page.getByLabel('Personal invitation link', { exact: true }).inputValue();
  assert(link.includes('/i/'));
  await page.screenshot({ path: resolve(artifacts, 'guest-settings.png'), fullPage: true });
  return link;
}

async function saveReply(page: Page) {
  await page.getByRole('radio', { name: 'Yes, I’ll be there', exact: true }).check();
  await page.getByRole('button', { name: 'Add a guest' }).click();
  await page.getByLabel('Guest 1 name', { exact: true }).fill('Jordan Reed');
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'You’re on the list' }).waitFor();
}

async function checkPagination({ page, origin }: { page: Page; origin: string }) {
  for (let index = 1; index <= PAGE_OVERFLOW_COUNT; index++) {
    const response = await page.request.post(`${origin}/api/admin/guests`, {
      headers: { origin },
      data: {
        name: `Example guest ${String(index).padStart(2, '0')}`,
        groupName: 'Test group',
        faceScanRequired: true,
        maxGuests: 0,
      },
    });
    assert(response.ok());
  }
  await page.reload();
  const final = page.getByText(`Example guest ${PAGE_OVERFLOW_COUNT}`, { exact: true });
  await page
    .getByRole('button', { name: 'Load more people', exact: true })
    .scrollIntoViewIfNeeded();
  await final.waitFor();
  await page.getByRole('searchbox', { name: 'Search guests' }).fill('Jordan Reed');
  await page.getByText('Jordan Reed', { exact: true }).waitFor();
}

await mkdir(artifacts, { recursive: true });
const videos = {
  genuine: await cameraVideo('same-person'),
  duplicate: await cameraVideo('reference'),
  stranger: await cameraVideo('different-person'),
};
const app = await startIsolatedApp();
const browsers: TestBrowser[] = [];
async function browser(cameraFile?: string) {
  const instance = await virtualPasskeyBrowser({ headless: true, cameraFile });
  browsers.push(instance);
  if (cameraFile) {
    await instance.page.context().grantPermissions(['camera'], { origin: app.origin });
  }
  instance.page.on('pageerror', (error) => console.error(error));
  return instance;
}
try {
  const admin = await browser();
  const page = admin.page;
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(app.origin);
  await page.getByRole('button', { name: 'Create dashboard with a passkey', exact: true }).click();
  await page.getByRole('heading', { name: 'Guest list', exact: true }).waitFor();
  const link = await createGuestInDashboard(page);
  const token = new URL(link).pathname.split('/').at(-1)!;
  const guestsResponse = await page.request.get(`${app.origin}/api/admin/guests`);
  const guest = ((await guestsResponse.json()) as { items: Guest[] }).items[0]!;
  const prefix = `${app.origin}/api/invitations/${token}`;
  const newcomer = await browser();
  await newcomer.page.goto(app.origin);
  await newcomer.page
    .getByRole('button', { name: 'Sign in with a passkey', exact: true })
    .waitFor();
  assert.equal(
    await newcomer.page.getByRole('button', { name: 'Create dashboard with a passkey' }).count(),
    0,
  );
  assert.equal(
    (await newcomer.page.request.get(`${app.origin}/api/admin/guests`)).status(),
    HTTP_UNAUTHORIZED,
  );
  assert.equal((await newcomer.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);
  assert.equal(
    (
      await newcomer.page.request.post(`${prefix}/session`, { headers: { origin: app.origin } })
    ).status(),
    HTTP_FORBIDDEN,
  );
  await newcomer.page.goto(link);
  await newcomer.page
    .getByRole('heading', { name: 'An important message for Taylor Reed.' })
    .waitFor();
  assert.equal(await newcomer.page.locator('input[type=file]').count(), 0);
  assert(!(await newcomer.page.locator('body').innerText()).includes('29 June'));
  await newcomer.page.setViewportSize(MOBILE_VIEWPORT);
  await newcomer.page.screenshot({
    path: resolve(artifacts, 'personal-message-mobile.png'),
    fullPage: true,
  });

  const duplicate = await browser(videos.duplicate);
  await duplicate.page.goto(link);
  await captureSelfie(duplicate.page);
  await duplicate.page.getByRole('alert').filter({ hasText: 'reference photo' }).waitFor();
  assert.equal((await duplicate.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);
  const stranger = await browser(videos.stranger);
  await stranger.page.goto(link);
  await captureSelfie(stranger.page);
  await stranger.page.getByRole('alert').filter({ hasText: 'could not match your face' }).waitFor();
  assert.equal((await stranger.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);

  const guestBrowser = await browser(videos.genuine);
  await guestBrowser.page.setViewportSize(MOBILE_VIEWPORT);
  await guestBrowser.page.goto(link);
  await captureSelfie(guestBrowser.page);
  await guestBrowser.page.getByRole('heading', { name: 'Massimo & Liza', exact: true }).waitFor();
  await saveReply(guestBrowser.page);
  await guestBrowser.page.screenshot({
    path: resolve(artifacts, 'invitation-mobile.png'),
    fullPage: true,
  });
  await guestBrowser.page.goto(link);
  await guestBrowser.page.getByRole('heading', { name: 'Massimo & Liza', exact: true }).waitFor();
  const excess = await guestBrowser.page.request.put(`${prefix}/rsvp`, {
    headers: { origin: app.origin },
    data: { status: 'accepted', companions: ['One', 'Two'] },
  });
  assert.equal(excess.status(), HTTP_BAD_REQUEST);
  const forwarded = await browser();
  await forwarded.page.goto(guestBrowser.page.url());
  await forwarded.page.getByRole('button', { name: 'Take a selfie', exact: true }).waitFor();
  assert.equal((await forwarded.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);

  const seeded = await seedGuests({ page, origin: app.origin });
  const bypass = seeded[4]!;
  await newcomer.page.goto(`${app.origin}/i/${bypass.token}`);
  await newcomer.page.getByRole('heading', { name: 'Massimo & Liza', exact: true }).waitFor();
  assert.equal(await newcomer.page.getByRole('button', { name: 'Take a selfie' }).count(), 0);
  await page.goto(app.origin);
  await page.getByText('Jordan Reed', { exact: true }).waitFor();
  const stats = await (await page.request.get(`${app.origin}/api/admin/stats`)).json();
  assert.deepEqual(stats, {
    invited: 7,
    accepted: 4,
    declined: 1,
    pending: 2,
    companions: 4,
    attending: 8,
  });
  await page.screenshot({ path: resolve(artifacts, 'guest-list-desktop.png'), fullPage: true });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.screenshot({ path: resolve(artifacts, 'guest-list-mobile.png'), fullPage: true });
  const scrollWidth = await page.locator('html').evaluate((element) => element.scrollWidth);
  assert.ok(
    scrollWidth <= MOBILE_VIEWPORT.width,
    'The mobile dashboard must not overflow horizontally.',
  );
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await checkPagination({ page, origin: app.origin });

  const csrf = await page.request.post(`${app.origin}/api/admin/guests`, {
    headers: { origin: 'https://untrusted.invalid' },
    data: { name: 'Injected', groupName: '', faceScanRequired: false, maxGuests: 0 },
  });
  assert.equal(csrf.status(), HTTP_FORBIDDEN);
  await page.goto(`${app.origin}/guests/${guest.id}`);
  await page.getByRole('button', { name: 'Sign out all devices', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'All devices signed out' }).waitFor();
  assert.equal(
    (await guestBrowser.page.request.get(`${prefix}/content`)).status(),
    HTTP_UNAUTHORIZED,
  );
  const rotation = page.waitForResponse((response) =>
    response.url().endsWith(`/guests/${guest.id}/rotate`),
  );
  await page.getByRole('button', { name: 'Replace link', exact: true }).click();
  assert((await rotation).ok());
  assert.equal((await newcomer.page.request.get(prefix)).status(), HTTP_NOT_FOUND);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in with a passkey', exact: true }).click();
  await page.getByRole('heading', { name: 'Guest list', exact: true }).waitFor();
  console.log(
    'Browser journey passed: passkeys, guest creation, real face matching, duplicate and wrong-face rejection, forwarding, remembered sessions, bypass, RSVP, counts, pagination, revocation, CSRF, and mobile layouts.',
  );
} catch (error) {
  for (const instance of browsers) {
    console.error(
      await instance.page
        .locator('body')
        .innerText()
        .catch(() => 'Browser unavailable'),
    );
  }
  throw error;
} finally {
  const closed = await Promise.allSettled(browsers.map((instance) => instance.close()));
  await app.stop();
  const failures = closed.filter((result) => result.status === 'rejected');
  if (failures.length) {
    console.error(
      new AggregateError(
        failures.map((result) => result.reason),
        'Browser cleanup failed',
      ),
    );
    process.exitCode = 1;
  }
}
