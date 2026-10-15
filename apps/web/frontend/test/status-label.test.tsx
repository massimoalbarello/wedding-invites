import { afterEach, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { StatusLabel } from '../src/components/status-label';
import type { Guest } from '../src/queries/guests';

const at = '2026-10-14T12:00:00.000Z';
const emptyActivity: Guest['activity'] = {
  linkOpenedAt: null,
  verificationFailedAt: null,
  verifiedAt: null,
  invitationOpenedAt: null,
};
afterEach(cleanup);

test.each([
  { activity: emptyActivity, label: 'Not opened' },
  { activity: { ...emptyActivity, linkOpenedAt: at }, label: 'Link opened' },
  {
    activity: { ...emptyActivity, linkOpenedAt: at, verificationFailedAt: at },
    label: 'Verification failed',
  },
  { activity: { ...emptyActivity, verificationFailedAt: at, verifiedAt: at }, label: 'Verified' },
  {
    activity: {
      ...emptyActivity,
      verificationFailedAt: at,
      verifiedAt: at,
      invitationOpenedAt: at,
    },
    label: 'Invitation opened',
  },
])('pending guests show $label for their furthest confirmed step', ({ activity, label }) => {
  render(<StatusLabel guest={{ status: 'pending', activity }} />);
  expect(screen.getByText(label).title).toContain('Awaiting reply');
  if (activity.verificationFailedAt) {
    expect(screen.getByText(label).title).toContain('Last verification failure');
  }
});

test.each(['accepted', 'declined'] as const)(
  'a %s response takes precedence over activity',
  (status) => {
    render(
      <StatusLabel
        guest={{
          status,
          activity: {
            linkOpenedAt: at,
            verificationFailedAt: at,
            verifiedAt: at,
            invitationOpenedAt: at,
          },
        }}
      />,
    );
    expect(screen.getByText(status === 'accepted' ? 'Accepted' : 'Declined')).toBeTruthy();
    expect(screen.queryByText('Invitation opened')).toBeNull();
  },
);
