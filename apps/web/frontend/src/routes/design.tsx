import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { AdminLayout } from '../components/admin-layout';
import { designKeys, designsOptions, saveDesign } from '../queries/designs';
import { invitationKeys } from '../queries/invitations';
import { sessionOptions } from '../queries/session';
import { DesignForm } from './-design/design-form';

export const Route = createFileRoute('/design')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionOptions);
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { userId: session.user.id };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(designsOptions(context.userId)),
  component: InvitationDesign,
});
function InvitationDesign() {
  const { userId } = Route.useRouteContext();
  const client = useQueryClient();
  const { data: catalog } = useSuspenseQuery(designsOptions(userId));
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: saveDesign,
    onSuccess: async (data) => {
      client.setQueryData(designKeys.owner(userId), data);
      await client.invalidateQueries({ queryKey: invitationKeys.all });
      setEditing(false);
    },
  });
  return (
    <AdminLayout>
      <main className="mx-auto max-w-3xl px-5 py-9 sm:px-10 sm:py-12">
        <Link to="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Guest list
        </Link>
        <h1 className="mt-8 font-semibold text-3xl tracking-tight">Invitation design</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          One design for all your invitations. Personal links and saved replies stay the same.
        </p>
        <DesignForm
          key={`${editing}:${catalog.selectedPackageId}`}
          catalog={catalog}
          editing={editing}
          pending={save.isPending}
          onEdit={() => {
            save.reset();
            setEditing(true);
          }}
          onCancel={() => {
            save.reset();
            setEditing(false);
          }}
          onSave={async (packageId) => {
            try {
              await save.mutateAsync(packageId);
            } catch {
              /* The mutation owns the visible error. */
            }
          }}
        />
        {save.error && (
          <p role="alert" className="mt-5 text-destructive text-sm">
            {save.error.message}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="mt-5 text-muted-foreground text-sm">
            Your selected design now applies to every invitation.
          </p>
        )}
      </main>
    </AdminLayout>
  );
}
