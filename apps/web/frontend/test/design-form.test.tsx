import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesignForm } from '../src/routes/-design/design-form';

const catalog = {
  selectedPackageId: 'amalfi',
  packages: [
    { id: 'amalfi', name: 'Amalfi', description: 'Coastal invitation' },
    { id: 'minimal', name: 'Simple letter', description: 'A quiet invitation' },
  ],
};
afterEach(cleanup);

test('changing the preview does not save a design until the owner explicitly saves', async () => {
  const user = userEvent.setup();
  const saved: string[] = [];
  render(
    <DesignForm
      catalog={catalog}
      editing
      pending={false}
      onEdit={() => {}}
      onCancel={() => {}}
      onSave={(id) => {
        saved.push(id);
        return Promise.resolve();
      }}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'Design for every invitation' }));
  await user.click(screen.getByRole('option', { name: 'Simple letter' }));
  expect(saved).toEqual([]);
  expect(screen.getByTitle('Design preview').getAttribute('src')).toContain('/minimal/');
  await user.click(screen.getByRole('button', { name: 'Save design' }));
  expect(saved).toEqual(['minimal']);
});
