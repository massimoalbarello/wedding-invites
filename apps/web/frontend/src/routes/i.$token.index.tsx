import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  invitationEntryOptions,
  invitationKeys,
  openInvitation,
  verifyFace,
} from '../queries/invitations';
import { SelfieCamera } from './-invitation/selfie-camera';

export const Route = createFileRoute('/i/$token/')({
  loader: async ({ context, params }) => {
    const entry = await context.queryClient.fetchQuery(invitationEntryOptions(params.token));
    if (!entry.faceScanRequired && !entry.authenticated) {
      await openInvitation(params.token);
      context.queryClient.removeQueries({ queryKey: invitationKeys.all });
    }
    if (entry.authenticated || !entry.faceScanRequired) {
      throw redirect({ to: '/i/$token/invitation', params: { token: params.token } });
    }
    return entry;
  },
  component: PersonalMessage,
});
function PersonalMessage() {
  const entry = Route.useLoaderData();
  const { token } = Route.useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const verify = useMutation({
    mutationFn: verifyFace,
    onSuccess: async () => {
      client.removeQueries({ queryKey: invitationKeys.all });
      await navigate({ to: '/i/$token/invitation', params: { token } });
    },
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-7 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        ✉
      </div>
      <p className="text-muted-foreground text-sm">A personal message</p>
      <h1 className="mt-3 break-words font-semibold text-3xl leading-tight tracking-tight">
        An important message for {entry.name}.
      </h1>
      <p className="mt-4 mb-8 text-muted-foreground">
        Before you open it, let’s make sure it’s you. Take a quick selfie to continue.
      </p>
      <SelfieCamera
        onRetake={() => verify.reset()}
        onVerify={(photo) => verify.mutate({ token, photo })}
        pending={verify.isPending}
        error={verify.error?.message}
      />
    </main>
  );
}
