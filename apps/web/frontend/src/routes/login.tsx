import { Button } from '@repo/ui/button';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ownerStatusOptions } from '../queries/guests';
import { registerAccount, sessionOptions, signIn } from '../queries/session';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.fetchQuery(sessionOptions)) {
      throw redirect({ to: '/' });
    }
  },
  loader: ({ context }) => context.queryClient.fetchQuery(ownerStatusOptions),
  component: Login,
});
function Login() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { data: owner } = useSuspenseQuery(ownerStatusOptions);
  const completed = async () => {
    client.clear();
    await navigate({ to: '/' });
  };
  const register = useMutation({ mutationFn: registerAccount, onSuccess: completed });
  const login = useMutation({ mutationFn: signIn, onSuccess: completed });
  const pending = register.isPending || login.isPending;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <span
        aria-hidden="true"
        className="mb-8 flex size-12 items-center justify-center rounded-xl bg-primary font-serif text-lg text-primary-foreground"
      >
        ✉
      </span>
      <p className="text-muted-foreground text-sm">Invitation dashboard</p>
      <h1 className="mt-3 font-semibold text-3xl tracking-tight">Your people, in one place.</h1>
      <p className="mt-4 text-muted-foreground">
        Manage personal invitations, familiar faces, and who’s joining you.
      </p>
      <div className="mt-8 flex flex-col items-start gap-3">
        {!owner.hasOwner ? (
          <Button size="lg" disabled={pending} onClick={() => register.mutate()}>
            {register.isPending ? 'Creating your dashboard…' : 'Create dashboard with a passkey'}
          </Button>
        ) : (
          <Button size="lg" disabled={pending} onClick={() => login.mutate()}>
            {login.isPending ? 'Signing in…' : 'Sign in with a passkey'}
          </Button>
        )}
      </div>
      {(register.error || login.error) && (
        <p role="alert" className="mt-5 text-destructive text-sm">
          {(register.error || login.error)?.message}
        </p>
      )}
      <p className="mt-6 text-muted-foreground text-xs">
        {owner.hasOwner
          ? 'Use the passkey you created for this dashboard.'
          : 'Set up the owner’s passkey to get started.'}
      </p>
    </main>
  );
}
