import assert from 'node:assert/strict';
import type { virtualPasskeyBrowser } from '@repo/browser-testing/browser';

type Page = Awaited<ReturnType<typeof virtualPasskeyBrowser>>['page'];

export const EXAMPLE_WEDDING = { coupleNames: 'Avery & Jordan', date: '2030-09-21' };

export async function seedWedding({ page, origin }: { page: Page; origin: string }) {
  const response = await page.request.put(`${origin}/api/admin/wedding`, {
    headers: { origin },
    data: EXAMPLE_WEDDING,
  });
  assert(response.ok(), 'Could not configure the example wedding.');
}
