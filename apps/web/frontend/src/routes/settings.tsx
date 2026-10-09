import { Button } from '@repo/ui/button';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AdminLayout } from '../components/admin-layout';
import { invitationKeys } from '../queries/invitations';
import { sessionOptions } from '../queries/session';
import { saveWedding, weddingKeys, weddingOptions } from '../queries/wedding';
import { WeddingForm } from './-settings/wedding-form';

export const Route = createFileRoute('/settings')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionOptions);
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { userId: session.user.id };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(weddingOptions(context.userId)),
  component: WeddingSettingsPage,
});
function WeddingSettingsPage() {
  const { userId } = Route.useRouteContext();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { data: wedding } = useSuspenseQuery(weddingOptions(userId));
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: saveWedding,
    onSuccess: async (settings) => {
      client.setQueryData(weddingKeys.owner(userId), settings);
      await client.invalidateQueries({ queryKey: invitationKeys.all });
      setEditing(false);
    },
  });
  return (
    <AdminLayout>
      <main className="mx-auto max-w-2xl px-5 py-9 sm:px-10 sm:py-12">
        <Link to="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Guest list
        </Link>
        <h1 className="mt-8 font-semibold text-3xl tracking-tight">Wedding settings</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The names and date your guests see after opening their invitation.
        </p>
        {!wedding || editing ? (
          <WeddingForm
            initial={wedding ?? { coupleNames: '', date: '' }}
            onCancel={() => {
              save.reset();
              setEditing(false);
              if (!wedding) {
                void navigate({ to: '/' });
              }
            }}
            onSave={async (value) => {
              try {
                await save.mutateAsync(value);
              } catch {
                /* The mutation owns its visible error state. */
              }
            }}
          />
        ) : (
          <>
            <div className="flex min-h-10 items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  save.reset();
                  setEditing(true);
                }}
              >
                Edit wedding
              </Button>
            </div>
            <dl className="mt-5 space-y-7 text-sm">
              <div>
                <dt className="text-muted-foreground">Couple names</dt>
                <dd className="mt-1.5 break-words font-medium">{wedding.coupleNames}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ceremony date</dt>
                <dd className="mt-1.5">
                  {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
                    new Date(`${wedding.date}T12:00:00Z`),
                  )}
                </dd>
              </div>
            </dl>
          </>
        )}
        {save.error && (
          <p role="alert" className="mt-5 text-destructive text-sm">
            {save.error.message}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="mt-5 text-muted-foreground text-sm">
            Your wedding details are saved.
          </p>
        )}
      </main>
    </AdminLayout>
  );
}
