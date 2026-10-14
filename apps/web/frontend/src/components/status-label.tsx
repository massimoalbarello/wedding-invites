export function StatusLabel({ status }: { status: 'pending' | 'accepted' | 'declined' }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-muted-foreground text-xs">
      <span aria-hidden="true">
        {status === 'accepted' ? '✓' : status === 'declined' ? '−' : '·'}
      </span>
      {status === 'accepted' ? 'Accepted' : status === 'declined' ? 'Declined' : 'Awaiting reply'}
    </span>
  );
}
