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

async function checkInvitationCopy({
  page,
  origin,
  guest,
}: {
  page: Page;
  origin: string;
  guest: Guest;
}) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const location = page.url();
  const copy = page.getByRole('button', {
    name: `Copy invitation link for ${guest.name}`,
    exact: true,
  });
  await copy.click();
  await copy.getByText('Copied', { exact: true }).waitFor();
  assert.equal(await page.evaluate('navigator.clipboard.readText()'), `${origin}/i/${guest.token}`);
  assert.equal(page.url(), location, 'Copying an invitation must not navigate away from the list.');
}

function invitationFrame(page: Page) {
  return page.frameLocator('iframe[title="Invitation"]');
}
async function openLetter(page: Page) {
  const frame = invitationFrame(page);
  await frame.getByRole('button', { name: 'Tap to open', exact: true }).click();
  await frame.getByRole('heading', { name: 'Elena & Marco', exact: true }).waitFor();
  await frame.locator('main.letter').evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .map((animation: { finished: Promise<unknown> }) => animation.finished),
    );
  });
}

async function checkDesignSelection(input: {
  page: Page;
  origin: string;
  guestPage: Page;
  bypassPage: Page;
  guest: Guest;
  bypass: Guest;
  noAllowance: Guest;
}) {
  const { page, origin } = input;
  const before = await (await page.request.get(`${origin}/api/admin/stats`)).json();
  await page.getByRole('link', { name: 'Invitation design', exact: true }).click();
  await page.getByRole('heading', { name: 'Invitation design', exact: true }).waitFor();
  const chooseSimple = async () => {
    await page.getByRole('button', { name: 'Edit design', exact: true }).click();
    await page.getByRole('combobox', { name: 'Design for every invitation', exact: true }).click();
    await page.getByRole('option', { name: 'Simple letter', exact: true }).waitFor();
    await page.screenshot({
      path: resolve(artifacts, 'design-choice-desktop.png'),
      fullPage: true,
    });
    await page.getByRole('option', { name: 'Simple letter', exact: true }).click();
    await page
      .frameLocator('iframe[title="Design preview"]')
      .getByRole('heading', { name: 'Elena & Marco', exact: true })
      .waitFor();
  };
  await chooseSimple();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(
    (await (await page.request.get(`${origin}/api/admin/designs`)).json()).selectedPackageId,
    'amalfi',
  );
  await chooseSimple();
  const preview = page.frameLocator('iframe[title="Design preview"]');
  await preview.getByRole('radio', { name: 'Yes, I’ll be there', exact: true }).check();
  await preview.getByRole('button', { name: 'Send reply', exact: true }).click();
  await preview.getByRole('status').filter({ hasText: 'Your reply is saved' }).waitFor();
  assert.deepEqual(await (await page.request.get(`${origin}/api/admin/stats`)).json(), before);
  await page.getByRole('button', { name: 'Save design', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'applies to every invitation' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Simple letter', exact: true }).waitFor();
  await page.screenshot({
    path: resolve(artifacts, 'design-selection-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.screenshot({
    path: resolve(artifacts, 'design-selection-mobile.png'),
    fullPage: true,
  });
  assert.ok(
    (await page.locator('html').evaluate((element) => element.scrollWidth)) <=
      MOBILE_VIEWPORT.width,
  );
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await input.guestPage.goto(`${origin}/i/${input.guest.token}`);
  const guest = invitationFrame(input.guestPage);
  await guest.getByRole('heading', { name: 'Elena & Marco', exact: true }).waitFor();
  assert.equal(await guest.getByRole('button', { name: 'Tap to open' }).count(), 0);
  assert.equal(await guest.getByLabel('Guest name', { exact: true }).inputValue(), 'Jordan Reed');
  await guest.getByRole('button', { name: 'Update reply', exact: true }).click();
  await guest.getByRole('status').filter({ hasText: 'Your reply is saved' }).waitFor();
  await input.guestPage.screenshot({
    path: resolve(artifacts, 'simple-letter-mobile.png'),
    fullPage: true,
  });
  await input.bypassPage.goto(`${origin}/i/${input.bypass.token}`);
  await invitationFrame(input.bypassPage)
    .getByRole('heading', { name: 'Elena & Marco', exact: true })
    .waitFor();
  assert.equal(
    await invitationFrame(input.bypassPage).getByRole('button', { name: 'Tap to open' }).count(),
    0,
  );
  const noAllowance = await browser();
  await noAllowance.page.goto(`${origin}/i/${input.noAllowance.token}`);
  const noAllowanceFrame = invitationFrame(noAllowance.page);
  await noAllowanceFrame.getByRole('radio', { name: 'Yes, I’ll be there', exact: true }).check();
  assert.equal(await noAllowanceFrame.getByRole('button', { name: 'Add a guest' }).count(), 0);
  assert.deepEqual(await (await page.request.get(`${origin}/api/admin/stats`)).json(), before);
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Guest list', exact: true }).waitFor();
}

async function createGuestInDashboard(page: Page) {
  await page.getByRole('link', { name: 'Add guest' }).click();
  assert.equal(await page.getByRole('switch', { name: 'Require a face scan' }).count(), 0);
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Full name', { exact: true }).fill('Taylor Reed');
  await page.getByRole('combobox', { name: 'Group', exact: true }).click();
  await page.getByRole('option', { name: 'Create a new group…', exact: true }).click();
  await page.getByRole('textbox', { name: 'New group name', exact: true }).fill('Friends');
  await page.getByLabel('Additional guests allowed', { exact: true }).fill('1');
  await page
    .getByLabel('Upload reference photos', { exact: true })
    .setInputFiles(resolve(fixtures, 'reference.jpg'));
  await page.getByRole('img', { name: 'Reference 1 for Taylor Reed', exact: true }).waitFor();
  await page.screenshot({
    path: resolve(artifacts, 'guest-creation-with-photo.png'),
    fullPage: true,
  });
  await page.getByLabel('Upload reference photos', { exact: true }).setInputFiles({
    name: 'invalid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('This is not an image.'),
  });
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('alert').waitFor();
  const origin = new URL(page.url()).origin;
  const empty = await page.request.get(`${origin}/api/admin/guests`);
  assert.equal(
    ((await empty.json()) as { items: Guest[] }).items.length,
    0,
    'A rejected photo must not create a partial guest.',
  );
  assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), 'Taylor Reed');
  await page.getByRole('button', { name: 'Remove reference photo 2', exact: true }).click();
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('heading', { name: 'Taylor Reed', exact: true }).waitFor();
  await page.getByRole('img', { name: 'Reference 1 for Taylor Reed', exact: true }).waitFor();
  const link = await page.getByLabel('Personal invitation link', { exact: true }).inputValue();
  assert(link.includes('/i/'));
  await page.screenshot({ path: resolve(artifacts, 'guest-settings.png'), fullPage: true });
  return link;
}

async function checkGuestPhotoEditing({
  page,
  origin,
  guest,
}: {
  page: Page;
  origin: string;
  guest: Guest;
}) {
  const detailUrl = `${origin}/guests/${guest.id}`;
  const current = async () => {
    const response = await page.request.get(`${origin}/api/admin/guests/${guest.id}`);
    assert(response.ok());
    return (await response.json()) as Guest & { references: { id: string }[] };
  };
  const first = (await current()).references[0]!.id;
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  await page
    .getByLabel('Upload reference photos', { exact: true })
    .setInputFiles(resolve(fixtures, 'different-person.jpg'));
  await page.getByRole('button', { name: 'Remove reference photo 1', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await current()).name, guest.name);
  assert.deepEqual(
    (await current()).references.map((photo) => photo.id),
    [first],
  );
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  await page
    .getByLabel('Upload reference photos', { exact: true })
    .setInputFiles(resolve(fixtures, 'different-person.jpg'));
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('button', { name: 'Edit guest', exact: true }).waitFor();
  const added = (await current()).references;
  assert.equal(added.length, 2);
  assert.equal(added[0]!.id, first);
  await checkAvatar({ page, origin, guest, photoId: first });
  await page.goto(detailUrl);
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  await page.getByRole('button', { name: 'Remove reference photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('button', { name: 'Edit guest', exact: true }).waitFor();
  assert.deepEqual(
    (await current()).references.map((photo) => photo.id),
    [added[1]!.id],
  );
  await checkAvatar({ page, origin, guest, photoId: added[1]!.id });
  await page.goto(detailUrl);
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  await page.getByRole('button', { name: 'Remove reference photo 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('button', { name: 'Edit guest', exact: true }).waitFor();
  assert.equal((await current()).references.length, 0);
  await page.goto(origin);
  const row = page.getByRole('link').filter({ hasText: guest.name }).first();
  await row.getByText('TR', { exact: true }).waitFor();
  assert.equal(await row.locator('img').count(), 0);
  const previouslyBypassed = await browser();
  await previouslyBypassed.page.goto(`${origin}/i/${guest.token}`);
  await openLetter(previouslyBypassed.page);
  assert.equal(
    await previouslyBypassed.page
      .getByRole('button', { name: 'Take a selfie', exact: true })
      .count(),
    0,
  );
  await page.goto(detailUrl);
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  await page
    .getByLabel('Upload reference photos', { exact: true })
    .setInputFiles(resolve(fixtures, 'reference.jpg'));
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('button', { name: 'Edit guest', exact: true }).waitFor();
  await previouslyBypassed.page.goto(`${origin}/i/${guest.token}`);
  await previouslyBypassed.page
    .getByRole('button', { name: 'Take a selfie', exact: true })
    .waitFor();
  assert.equal(
    (
      await previouslyBypassed.page.request.get(`${origin}/api/invitations/${guest.token}/content`)
    ).status(),
    HTTP_UNAUTHORIZED,
  );
  await page.screenshot({ path: resolve(artifacts, 'guest-settings.png'), fullPage: true });
}

async function checkAvatar({
  page,
  origin,
  guest,
  photoId,
}: {
  page: Page;
  origin: string;
  guest: Guest;
  photoId: string;
}) {
  await page.goto(origin);
  const avatar = page.getByRole('link').filter({ hasText: guest.name }).first().locator('img');
  await avatar.waitFor();
  assert.equal(await avatar.getAttribute('src'), `/api/admin/guests/${guest.id}/photos/${photoId}`);
  await avatar.evaluate((element) => {
    if ('decode' in element && typeof element.decode === 'function') {
      return element.decode();
    }
    throw new Error('Expected an avatar image.');
  });
}

async function saveReply(page: Page) {
  const frame = invitationFrame(page);
  await frame.getByRole('radio', { name: 'Yes, I’ll be there', exact: true }).check();
  await frame.getByRole('button', { name: 'Add a guest' }).click();
  await frame.getByLabel('Guest 1 name', { exact: true }).fill('Jordan Reed');
  await frame.getByRole('button', { name: 'Send reply', exact: true }).click();
  await frame.getByRole('status').filter({ hasText: 'You’re on the list' }).waitFor();
}

async function checkGuestGrouping({ page, origin }: { page: Page; origin: string }) {
  await page.goto(origin);
  await page.getByRole('link', { name: 'Add guest' }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Riley Brooks');
  const chooseGroup = async (name: string) => {
    await page.getByRole('combobox', { name: 'Group', exact: true }).click();
    await page.getByRole('option', { name, exact: true }).click();
  };
  await chooseGroup('Friends');
  await page.screenshot({ path: resolve(artifacts, 'guest-existing-group.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await page.getByRole('heading', { name: 'Riley Brooks', exact: true }).waitFor();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const savedGroup = async () => {
    const response = await page.request.get(`${origin}/api/admin/guests/${id}`);
    assert(response.ok());
    return ((await response.json()) as { groupName: string }).groupName;
  };
  assert.equal(await savedGroup(), 'Friends');
  const noReference = await browser();
  await noReference.page.goto(
    await page.getByLabel('Personal invitation link', { exact: true }).inputValue(),
  );
  await openLetter(noReference.page);
  assert.equal(
    await noReference.page.getByRole('button', { name: 'Take a selfie', exact: true }).count(),
    0,
  );
  await noReference.page.screenshot({
    path: resolve(artifacts, 'invitation-without-reference.png'),
    fullPage: true,
  });
  for (const group of ['', 'Neighbours', 'Friends']) {
    await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
    await chooseGroup(group === 'Neighbours' ? 'Create a new group…' : group || 'Ungrouped');
    if (group === 'Neighbours') {
      await page.getByRole('textbox', { name: 'New group name', exact: true }).fill(group);
    }
    await page.getByRole('button', { name: 'Save guest', exact: true }).click();
    await page.getByRole('button', { name: 'Edit guest', exact: true }).waitFor();
    assert.equal(await savedGroup(), group);
  }
  await page.goto(origin);
  await page
    .getByRole('region', { name: 'Friends', exact: true })
    .getByText('Riley Brooks', { exact: true })
    .waitFor();
  await page
    .getByRole('region', { name: 'Family', exact: true })
    .getByText('Jamie Chen', { exact: true })
    .waitFor();
  await page
    .getByRole('region', { name: 'Ungrouped', exact: true })
    .getByText('Charlie Lane', { exact: true })
    .waitFor();
  await page.getByRole('combobox', { name: 'Filter by group', exact: true }).click();
  await page.getByRole('option', { name: 'Ungrouped', exact: true }).click();
  await page.reload();
  await page
    .getByRole('region', { name: 'Ungrouped', exact: true })
    .getByText('Charlie Lane', { exact: true })
    .waitFor();
  assert.equal(await page.getByRole('region', { name: 'Friends', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('region', { name: 'Friends', exact: true }).waitFor();
}

async function checkPagination({ page, origin }: { page: Page; origin: string }) {
  for (let index = 1; index <= PAGE_OVERFLOW_COUNT; index++) {
    const response = await page.request.post(`${origin}/api/admin/guests`, {
      headers: { origin },
      data: {
        name: `Example guest ${String(index).padStart(2, '0')}`,
        groupName: 'Test group',
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
  const group = page.getByRole('region', { name: 'Test group', exact: true });
  assert.equal(await group.count(), 1, 'A group spanning pages must keep one section.');
  assert.equal(
    await group.getByRole('link').filter({ hasText: 'Example guest' }).count(),
    PAGE_OVERFLOW_COUNT,
  );
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
async function browser(
  input: {
    cameraFile?: string;
    recordVideo?: Parameters<typeof virtualPasskeyBrowser>[0]['recordVideo'];
  } = {},
) {
  const instance = await virtualPasskeyBrowser({ headless: true, ...input });
  browsers.push(instance);
  if (input.cameraFile) {
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
  const anonymousMessage = await newcomer.page.locator('body').innerText();
  assert(!anonymousMessage.includes('Elena'));
  assert(!anonymousMessage.includes('September'));
  await newcomer.page.setViewportSize(MOBILE_VIEWPORT);
  await newcomer.page.screenshot({
    path: resolve(artifacts, 'personal-message-mobile.png'),
    fullPage: true,
  });

  const duplicate = await browser({ cameraFile: videos.duplicate });
  await duplicate.page.goto(link);
  await captureSelfie(duplicate.page);
  await duplicate.page.getByRole('alert').filter({ hasText: 'reference photo' }).waitFor();
  assert.equal((await duplicate.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);
  const stranger = await browser({ cameraFile: videos.stranger });
  await stranger.page.goto(link);
  await captureSelfie(stranger.page);
  await stranger.page.getByRole('alert').filter({ hasText: 'could not match your face' }).waitFor();
  assert.equal((await stranger.page.request.get(`${prefix}/content`)).status(), HTTP_UNAUTHORIZED);

  const guestBrowser = await browser({
    cameraFile: videos.genuine,
    recordVideo: { dir: resolve(artifacts, 'recordings'), size: MOBILE_VIEWPORT },
  });
  await guestBrowser.page.setViewportSize(MOBILE_VIEWPORT);
  await guestBrowser.page.goto(link);
  await captureSelfie(guestBrowser.page);
  console.log(`Invitation recording: ${await guestBrowser.page.video()!.path()}`);
  await invitationFrame(guestBrowser.page)
    .getByRole('button', { name: 'Tap to open', exact: true })
    .waitFor();
  await guestBrowser.page.screenshot({
    path: resolve(artifacts, 'amalfi-envelope-mobile.png'),
    fullPage: true,
  });
  await openLetter(guestBrowser.page);
  await guestBrowser.page.screenshot({
    path: resolve(artifacts, 'amalfi-letter-mobile.png'),
    fullPage: true,
  });
  await invitationFrame(guestBrowser.page)
    .getByText('June 29, 2027', { exact: true })
    .first()
    .waitFor();
  await saveReply(guestBrowser.page);
  await guestBrowser.page.screenshot({
    path: resolve(artifacts, 'invitation-mobile.png'),
    fullPage: true,
  });
  await guestBrowser.page.goto(link);
  await guestBrowser.page.emulateMedia({ reducedMotion: 'reduce' });
  await openLetter(guestBrowser.page);
  await invitationFrame(guestBrowser.page)
    .getByLabel('Guest 1 name', { exact: true })
    .fill('Jordan Reed');
  await invitationFrame(guestBrowser.page)
    .getByRole('button', { name: 'Update reply', exact: true })
    .click();
  await invitationFrame(guestBrowser.page)
    .getByRole('status')
    .filter({ hasText: 'You’re on the list' })
    .waitFor();
  await guestBrowser.page.setViewportSize(DESKTOP_VIEWPORT);
  await invitationFrame(guestBrowser.page)
    .getByRole('heading', { name: 'Elena & Marco', exact: true })
    .scrollIntoViewIfNeeded();
  await guestBrowser.page.screenshot({
    path: resolve(artifacts, 'amalfi-letter-desktop.png'),
    fullPage: true,
  });
  const photo = invitationFrame(guestBrowser.page).getByRole('button', {
    name: 'Enlarge: An embrace above the sea',
    exact: true,
  });
  await photo.click();
  await invitationFrame(guestBrowser.page).getByRole('button', { name: 'Close photo' }).click();
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
  await checkGuestPhotoEditing({ page, origin: app.origin, guest });
  await guestBrowser.page.goto(link);
  await captureSelfie(guestBrowser.page);
  await openLetter(guestBrowser.page);
  await checkGuestGrouping({ page, origin: app.origin });
  const bypass = seeded[4]!;
  await newcomer.page.goto(`${app.origin}/i/${bypass.token}`);
  await openLetter(newcomer.page);
  assert.equal(await newcomer.page.getByRole('button', { name: 'Take a selfie' }).count(), 0);
  await page.goto(app.origin);
  await page.getByText('Jordan Reed', { exact: true }).waitFor();
  const stats = await (await page.request.get(`${app.origin}/api/admin/stats`)).json();
  assert.deepEqual(stats, {
    invited: 8,
    accepted: 4,
    declined: 1,
    pending: 3,
    companions: 4,
    attending: 8,
  });
  for (const replied of [guest, seeded[0]!, seeded[3]!]) {
    assert.equal(
      await page
        .getByRole('button', { name: `Copy invitation link for ${replied.name}`, exact: true })
        .count(),
      0,
      'Guests who accepted or declined should not have a copy action in the list.',
    );
  }
  await page
    .getByRole('button', { name: `Copy invitation link for ${bypass.name}`, exact: true })
    .getByText('Invitation link', { exact: true })
    .waitFor();
  await page.screenshot({ path: resolve(artifacts, 'guest-list-desktop.png'), fullPage: true });
  await checkInvitationCopy({ page, origin: app.origin, guest: bypass });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.screenshot({ path: resolve(artifacts, 'guest-list-mobile.png'), fullPage: true });
  await checkInvitationCopy({ page, origin: app.origin, guest: seeded[5]! });
  const scrollWidth = await page.locator('html').evaluate((element) => element.scrollWidth);
  assert.ok(
    scrollWidth <= MOBILE_VIEWPORT.width,
    'The mobile dashboard must not overflow horizontally.',
  );
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await checkPagination({ page, origin: app.origin });
  await checkDesignSelection({
    page,
    origin: app.origin,
    guestPage: guestBrowser.page,
    bypassPage: newcomer.page,
    guest,
    bypass,
    noAllowance: seeded[5]!,
  });

  const csrf = await page.request.post(`${app.origin}/api/admin/guests`, {
    headers: { origin: 'https://untrusted.invalid' },
    data: { name: 'Injected', groupName: '', maxGuests: 0 },
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
    'Browser journey passed: passkeys, private invitation assets, owner-wide design selection and preview, and iframe RSVP, atomic guest photo creation and editing, group creation/joining/leaving, grouped pagination and ungrouped filtering, cancellation, avatar promotion and fallback, invitation link copying, real face matching, duplicate and wrong-face rejection, forwarding, remembered sessions, bypass, RSVP, counts, pagination, revocation, CSRF, and mobile layouts.',
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
