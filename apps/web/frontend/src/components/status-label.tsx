import type { Guest } from '../queries/guests';

type StatusGuest = Pick<Guest, 'status' | 'activity'>;

function labelFor({ status, activity }: StatusGuest) {
  if (status === 'accepted') {
    return {
      text: 'Accepted',
      icon: '✓',
      color: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    };
  }
  if (status === 'declined') {
    return {
      text: 'Declined',
      icon: '−',
      color: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    };
  }
  if (activity.invitationOpenedAt) {
    return {
      text: 'Invitation opened',
      icon: '✉',
      color: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    };
  }
  if (activity.verifiedAt) {
    return {
      text: 'Verified',
      icon: '✓',
      color: 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
    };
  }
  if (activity.verificationFailedAt) {
    return { text: 'Verification failed', icon: '!', color: 'bg-destructive/10 text-destructive' };
  }
  if (activity.linkOpenedAt) {
    return {
      text: 'Link opened',
      icon: '↗',
      color: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    };
  }
  return { text: 'Not opened', icon: '·', color: 'bg-muted text-muted-foreground' };
}

export function StatusLabel({ guest }: { guest: StatusGuest }) {
  const label = labelFor(guest);
  const history = [
    ['Link opened', guest.activity.linkOpenedAt],
    ['Last verification failure', guest.activity.verificationFailedAt],
    ['Verified', guest.activity.verifiedAt],
    ['Invitation opened', guest.activity.invitationOpenedAt],
  ].flatMap(([name, at]) => (at ? [`${name}: ${new Date(at).toLocaleString()}`] : []));
  if (guest.status === 'pending') {
    history.push('Awaiting reply');
  }
  return (
    <span
      title={history.join('\n') || label.text}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-medium text-xs ${label.color}`}
    >
      <span aria-hidden="true">{label.icon}</span>
      {label.text}
    </span>
  );
}
