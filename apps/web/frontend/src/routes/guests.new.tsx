import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { AdminLayout } from '../components/admin-layout';
import { GuestForm } from '../components/guest-form';
import { createGuest, groupsOptions, guestKeys } from '../queries/guests';
import { sessionOptions } from '../queries/session';

export const Route = createFileRoute('/guests/new')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionOptions);
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { userId: session.user.id };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(groupsOptions(context.userId)),
  component: NewGuest,
});
function NewGuest() {
  const { userId } = Route.useRouteContext();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { data: groups } = useSuspenseQuery(groupsOptions(userId));
  const create = useMutation({
    mutationFn: createGuest,
    onSuccess: async (guest) => {
      await client.invalidateQueries({ queryKey: guestKeys.owner(userId) });
      await navigate({ to: '/guests/$guestId', params: { guestId: guest.id } });
    },
  });
  return (
    <AdminLayout>
      <main className="mx-auto max-w-2xl px-5 py-9 sm:px-10 sm:py-12">
        <Link to="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Guest list
        </Link>
        <h1 className="mt-8 font-semibold text-3xl tracking-tight">Add a guest</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Add their details and photos to create a personal invitation.
        </p>
        <GuestForm
          initial={{ name: '', groupName: '', faceScanRequired: true, maxGuests: 0 }}
          groups={groups}
          onCancel={() => {
            void navigate({ to: '/' });
          }}
          onSave={async (value) => {
            try {
              await create.mutateAsync(value);
            } catch {
              /* The mutation owns its visible error state. */
            }
          }}
        />
        {create.error && (
          <p role="alert" className="mt-5 text-destructive text-sm">
            {create.error.message}
          </p>
        )}
      </main>
    </AdminLayout>
  );
}
