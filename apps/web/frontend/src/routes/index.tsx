import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { AdminLayout } from '../components/admin-layout';
import { CopyInvitationLink } from '../components/copy-invitation-link';
import { GuestAvatar } from '../components/guest-avatar';
import { StatusLabel } from '../components/status-label';
import {
  type Guest,
  type GuestFilters,
  groupsOptions,
  guestsOptions,
  statsOptions,
} from '../queries/guests';
import { sessionOptions } from '../queries/session';
import { weddingOptions } from '../queries/wedding';

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): GuestFilters => ({
    search: typeof search.search === 'string' && search.search ? search.search : undefined,
    status:
      search.status === 'accepted' || search.status === 'declined' || search.status === 'pending'
        ? search.status
        : undefined,
    group: typeof search.group === 'string' ? search.group : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionOptions);
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { userId: session.user.id };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureInfiniteQueryData(
        guestsOptions({ ownerId: context.userId, filters: deps }),
      ),
      context.queryClient.ensureQueryData(statsOptions(context.userId)),
      context.queryClient.ensureQueryData(groupsOptions(context.userId)),
      context.queryClient.ensureQueryData(weddingOptions(context.userId)),
    ]);
  },
  component: GuestList,
});
function GuestList() {
  const { userId } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: stats } = useSuspenseQuery(statsOptions(userId));
  const { data: groups } = useSuspenseQuery(groupsOptions(userId));
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, error } =
    useSuspenseInfiniteQuery(guestsOptions({ ownerId: userId, filters }));
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);
  const guests = data.pages.flatMap((page) => page.items);
  const filter = (next: Partial<GuestFilters>) => {
    void navigate({ search: { ...filters, ...next }, replace: true });
  };
  const filtered = Boolean(filters.search || filters.status || filters.group !== undefined);
  return (
    <AdminLayout>
      <main className="mx-auto max-w-6xl px-5 py-9 sm:px-10 sm:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-muted-foreground text-sm">Invitations</p>
            <h1 className="font-semibold text-3xl tracking-tight">Guest list</h1>
          </div>
          <Button render={<Link to="/guests/new" />} size="lg">
            + Add guest
          </Button>
        </div>
        <WeddingSetup ownerId={userId} />
        <dl className="my-9 grid grid-cols-3 gap-x-6 gap-y-6 sm:grid-cols-6">
          {[
            ['Invited', stats.invited],
            ['Accepted', stats.accepted],
            ['Awaiting reply', stats.pending],
            ['Declined', stats.declined],
            ['Additional guests', stats.companions],
            ['Total attending', stats.attending],
          ].map(([label, count]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-xs sm:text-sm">{label}</dt>
              <dd className="mt-1.5 font-medium text-2xl tabular-nums tracking-tight">{count}</dd>
            </div>
          ))}
        </dl>
        <div className="mb-5 flex flex-wrap items-center gap-3 border-border border-t pt-6">
          <Input
            type="search"
            aria-label="Search guests"
            placeholder="Search people…"
            className="min-w-48 flex-1 sm:max-w-sm"
            value={filters.search ?? ''}
            onValueChange={(search) => filter({ search: search || undefined })}
          />
          <Select<NonNullable<GuestFilters['status']> | ''>
            items={replyFilters}
            value={filters.status ?? ''}
            onValueChange={(value) => filter({ status: value || undefined })}
          >
            <SelectTrigger aria-label="Filter by reply">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {replyFilters.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groups.length > 0 && (
            <Select
              items={[
                { value: 'all', label: 'All groups' },
                { value: 'ungrouped', label: 'Ungrouped' },
                ...groups.map((group) => ({ value: `group:${group}`, label: group })),
              ]}
              value={
                filters.group === undefined
                  ? 'all'
                  : filters.group === ''
                    ? 'ungrouped'
                    : `group:${filters.group}`
              }
              onValueChange={(value) => {
                if (value !== null) {
                  filter({
                    group:
                      value === 'all'
                        ? undefined
                        : value === 'ungrouped'
                          ? ''
                          : value.slice('group:'.length),
                  });
                }
              }}
            >
              <SelectTrigger aria-label="Filter by group" className="max-w-44">
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                <SelectItem value="ungrouped">Ungrouped</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group} value={`group:${group}`}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                void navigate({ search: {} });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <section aria-label="Invited people and their guests">
          {guests.length === 0 ? (
            <div className="py-20 text-center">
              <h2 className="font-medium text-lg">
                {filtered ? 'No people match these filters' : 'Your guest list starts here'}
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                {filtered
                  ? 'Try another name, reply, or group.'
                  : 'Add someone to create their personal invitation.'}
              </p>
              {!filtered && (
                <Button render={<Link to="/guests/new" />} variant="outline" className="mt-6">
                  Add your first guest
                </Button>
              )}
            </div>
          ) : (
            <GuestGroups guests={guests} />
          )}
          <ListContinuation
            sentinel={sentinel}
            loading={isFetchingNextPage}
            hasMore={hasNextPage}
            failed={isFetchNextPageError}
            hasGuests={guests.length > 0}
            loadMore={() => {
              void fetchNextPage();
            }}
          />

          {isFetchNextPageError && (
            <p role="alert" className="text-center text-destructive text-sm">
              {error?.message}
            </p>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}

function GuestGroups({ guests }: { guests: Guest[] }) {
  const grouped = new Map<string, Guest[]>();
  for (const guest of guests) {
    const members = grouped.get(guest.groupName) ?? [];
    members.push(guest);
    grouped.set(guest.groupName, members);
  }
  return (
    <div className="space-y-8">
      {Array.from(grouped, ([group, members]) => (
        <section key={group} aria-label={group || 'Ungrouped'}>
          <h2 className="mb-2 break-words px-3 font-medium text-muted-foreground text-sm sm:px-4">
            {group || 'Ungrouped'}
          </h2>
          <GuestRows guests={members} />
        </section>
      ))}
    </div>
  );
}

function GuestRows({ guests }: { guests: Guest[] }) {
  return (
    <ul className="space-y-1">
      {guests.map((guest) => (
        <li key={guest.id}>
          <div className="flex items-center gap-2 rounded-xl pr-3 hover:bg-muted/60 sm:pr-4">
            <Link
              to="/guests/$guestId"
              params={{ guestId: guest.id }}
              className="grid min-h-20 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-xl px-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-4"
            >
              <div className="row-span-2 sm:row-span-1">
                <GuestAvatar guest={guest} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{guest.name}</p>
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  {[
                    guest.faceScanRequired ? 'Face scan' : 'Direct access',
                    guest.maxGuests > 0
                      ? `Up to ${guest.maxGuests} additional ${guest.maxGuests === 1 ? 'guest' : 'guests'}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
                <StatusLabel status={guest.status} />
                {!guest.active && (
                  <span className="text-muted-foreground text-xs">Access paused</span>
                )}
              </div>
              <span aria-hidden="true" className="hidden text-muted-foreground sm:block">
                →
              </span>
            </Link>
            <CopyInvitationLink key={guest.token} token={guest.token} name={guest.name} />
          </div>
          {guest.companions.map((companion) => (
            <Link
              key={companion.id}
              to="/guests/$guestId"
              params={{ guestId: guest.id }}
              className="ml-7 flex min-h-16 items-center gap-4 rounded-xl px-3 py-3 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:ml-8 sm:px-4"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs"
              >
                +1
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{companion.name}</p>
                <p className="mt-0.5 truncate text-muted-foreground text-xs">
                  Guest of {guest.name}
                </p>
              </div>
              <span className="text-muted-foreground text-xs">Attending</span>
            </Link>
          ))}
        </li>
      ))}
    </ul>
  );
}

function ListContinuation({
  sentinel,
  loading,
  hasMore,
  failed,
  hasGuests,
  loadMore,
}: {
  sentinel: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  hasMore: boolean;
  failed: boolean;
  hasGuests: boolean;
  loadMore: () => void;
}) {
  return (
    <div ref={sentinel} className="flex min-h-20 items-center justify-center" aria-live="polite">
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading more people…</p>
      ) : hasMore ? (
        <Button
          variant="ghost"
          onClick={() => {
            loadMore();
          }}
        >
          {failed ? 'Try loading again' : 'Load more people'}
        </Button>
      ) : hasGuests ? (
        <p className="text-muted-foreground text-xs">Everyone’s here.</p>
      ) : null}
    </div>
  );
}

const replyFilters: { value: NonNullable<GuestFilters['status']> | ''; label: string }[] = [
  { value: '', label: 'All replies' },
  { value: 'pending', label: 'Awaiting reply' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

function WeddingSetup({ ownerId }: { ownerId: string }) {
  const { data: wedding } = useSuspenseQuery(weddingOptions(ownerId));
  if (wedding) {
    return null;
  }
  return (
    <aside className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/60 p-5">
      <div>
        <h2 className="font-medium text-sm">Set up your wedding</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Add your names and ceremony date before sharing invitations.
        </p>
      </div>
      <Button variant="outline" render={<Link to="/settings" />}>
        Add wedding details
      </Button>
    </aside>
  );
}
