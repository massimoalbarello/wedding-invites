import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WeddingSettings } from '../src/queries/wedding';
import { WeddingForm } from '../src/routes/-settings/wedding-form';

afterEach(cleanup);
test('a new wedding starts blank and requires names and a ceremony date before saving', async () => {
  const user = userEvent.setup();
  const saves: WeddingSettings[] = [];
  render(
    <WeddingForm
      initial={{ coupleNames: '', date: '' }}
      onCancel={() => {}}
      onSave={(settings) => {
        saves.push(settings);
        return Promise.resolve();
      }}
    />,
  );
  expect((screen.getByLabelText('Couple names') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Ceremony date') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save wedding' }));
  expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
    'Enter the couple’s names.',
    'Choose your ceremony date.',
  ]);
  expect(saves).toEqual([]);
  await user.type(screen.getByLabelText('Couple names'), 'Avery & Jordan');
  fireEvent.change(screen.getByLabelText('Ceremony date'), { target: { value: '2030-09-21' } });
  await user.click(screen.getByRole('button', { name: 'Save wedding' }));
  await waitFor(() =>
    expect(saves).toEqual([{ coupleNames: 'Avery & Jordan', date: '2030-09-21' }]),
  );
});
