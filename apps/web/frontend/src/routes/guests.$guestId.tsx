import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { AdminLayout } from '../components/admin-layout';
import { GuestAvatar } from '../components/guest-avatar';
import { GuestForm } from '../components/guest-form';
import { StatusLabel } from '../components/status-label';
import {
  type Guest,
  groupsOptions,
  guestKeys,
  guestOptions,
  referenceUrl,
  revokeGuestSessions,
  rotateInvitation,
  setGuestAccess,
  updateGuest,
} from '../queries/guests';
import { sessionOptions } from '../queries/session';

export const Route = createFileRoute('/guests/$guestId')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionOptions);
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { userId: session.user.id };
  },
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        guestOptions({ ownerId: context.userId, id: params.guestId }),
      ),
      context.queryClient.ensureQueryData(groupsOptions(context.userId)),
    ]);
  },
  component: GuestDetail,
});
function GuestDetail() {
  const { userId } = Route.useRouteContext();
  const { guestId } = Route.useParams();
  const client = useQueryClient();
  const { data: guest } = useSuspenseQuery(guestOptions({ ownerId: userId, id: guestId }));
  const { data: groups } = useSuspenseQuery(groupsOptions(userId));
  const [editing, setEditing] = useState(false);
  const update = useMutation({
    mutationFn: updateGuest,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: guestKeys.owner(userId) });
      setEditing(false);
    },
  });
  return (
    <AdminLayout>
      <main className="mx-auto max-w-3xl px-5 py-9 sm:px-10 sm:py-12">
        <Link to="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Guest list
        </Link>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <GuestAvatar guest={guest} />
          <h1 className="min-w-0 break-words font-semibold text-3xl tracking-tight">
            {guest.name}
          </h1>
          <StatusLabel status={guest.status} />
        </div>
        {editing ? (
          <GuestForm
            key={guest.id}
            initial={{
              name: guest.name,
              groupName: guest.groupName,
              faceScanRequired: guest.faceScanRequired,
              maxGuests: guest.maxGuests,
            }}
            references={guest.references.map((photo) => ({
              id: photo.id,
              src: referenceUrl({ id: guest.id, photoId: photo.id }),
            }))}
            groups={groups}
            onCancel={() => {
              update.reset();
              setEditing(false);
            }}
            onSave={async (input) => {
              try {
                await update.mutateAsync({ id: guestId, input });
              } catch {
                /* The mutation owns its visible error state. */
              }
            }}
          />
        ) : (
          <>
            <div className="flex min-h-10 items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit guest
              </Button>
            </div>
            <GuestIdentity guest={guest} />
          </>
        )}
        {update.error && (
          <p role="alert" className="mt-5 text-destructive text-sm">
            {update.error.message}
          </p>
        )}
        {!editing && <GuestPhotos guest={guest} />}
        <GuestAccess guest={guest} ownerId={userId} />
        {guest.companions.length > 0 && (
          <section className="mt-8 border-border border-t pt-7">
            <h2 className="font-medium">Coming with {guest.name.split(' ')[0]}</h2>
            <ul className="mt-3 space-y-3">
              {guest.companions.map((companion) => (
                <li key={companion.id} className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
                    +1
                  </span>
                  {companion.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AdminLayout>
  );
}
function GuestIdentity({ guest }: { guest: Guest }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-7 gap-y-6 text-sm">
      <div>
        <dt className="text-muted-foreground">Group</dt>
        <dd className="mt-1.5">{guest.groupName || 'No group'}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Additional guests allowed</dt>
        <dd className="mt-1.5">
          {guest.maxGuests === 0 ? 'Just them' : `Up to ${guest.maxGuests}`}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Invitation entry</dt>
        <dd className="mt-1.5">
          {guest.faceScanRequired ? 'Face scan required' : 'Direct access'}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Access</dt>
        <dd className="mt-1.5">{guest.active ? 'Active' : 'Paused'}</dd>
      </div>
    </dl>
  );
}
function GuestPhotos({ guest }: { guest: Guest }) {
  return (
    <section className="mt-9 space-y-4 border-border border-t pt-7" aria-labelledby="photos-title">
      <h2 id="photos-title" className="font-medium">
        Reference photos{' '}
        <span className="ml-1 text-muted-foreground">{guest.references.length}</span>
      </h2>
      {guest.references.length === 0 ? (
        <p className="rounded-xl bg-muted/60 px-5 py-7 text-center text-muted-foreground text-sm">
          No photos yet. Edit this guest to add reference photos.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from(guest.references.entries()).map(([index, photo]) => (
            <li key={photo.id} className="space-y-1.5">
              <img
                src={referenceUrl({ id: guest.id, photoId: photo.id })}
                alt={`Reference ${index + 1} for ${guest.name}`}
                className="aspect-square w-full rounded-lg bg-muted object-cover"
              />
              {index === 0 && <p className="text-muted-foreground text-xs">Avatar</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function GuestAccess({ guest, ownerId }: { guest: Guest; ownerId: string }) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: guestKeys.owner(ownerId) });
  const rotate = useMutation({ mutationFn: rotateInvitation, onSuccess: refresh });
  const access = useMutation({ mutationFn: setGuestAccess, onSuccess: refresh });
  const sessions = useMutation({ mutationFn: revokeGuestSessions });
  const error = rotate.error || access.error || sessions.error;
  return (
    <section className="mt-8 space-y-4 border-border border-t pt-7" aria-labelledby="link-title">
      <h2 id="link-title" className="font-medium">
        Personal invitation
      </h2>
      <InvitationLink key={guest.token} token={guest.token} />
      <p className="text-muted-foreground text-sm">
        {guest.faceScanRequired
          ? 'This link asks for their face before opening the invitation.'
          : 'This link opens the invitation directly, without a face scan.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={rotate.isPending}
          onClick={() => rotate.mutate(guest.id)}
        >
          {rotate.isPending ? 'Replacing…' : 'Replace link'}
        </Button>
        <Button
          variant="ghost"
          disabled={sessions.isPending}
          onClick={() => sessions.mutate(guest.id)}
        >
          {sessions.isPending ? 'Signing out…' : 'Sign out all devices'}
        </Button>
        <Button
          variant={guest.active ? 'ghost' : 'outline'}
          disabled={access.isPending}
          onClick={() => access.mutate({ id: guest.id, active: !guest.active })}
        >
          {access.isPending ? 'Updating…' : guest.active ? 'Pause access' : 'Restore access'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Replacing a link disables the old one and signs out their devices.
      </p>
      {sessions.isSuccess && (
        <p role="status" className="text-muted-foreground text-sm">
          All devices signed out.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}
    </section>
  );
}
function InvitationLink({ token }: { token: string }) {
  const link = `${window.location.origin}/i/${encodeURIComponent(token)}`;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Personal invitation link"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-muted-foreground text-sm">
          Select and copy the link above.
        </p>
      )}
    </div>
  );
}
