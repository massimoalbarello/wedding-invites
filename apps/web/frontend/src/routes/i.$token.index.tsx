import { Button } from '@repo/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  FaceMismatchError,
  invitationEntryOptions,
  invitationKeys,
  openInvitation,
  verifyFace,
} from '../queries/invitations';
import {
  PersonalInvitationCover,
  SecretPaper,
  SecretScene,
  SecretStamp,
} from './-invitation/secret-paper';
import { SelfDestruct } from './-invitation/self-destruct';
import { SelfieCamera } from './-invitation/selfie-camera';

export const Route = createFileRoute('/i/$token/')({
  loader: async ({ context, params }) => {
    const entry = await context.queryClient.fetchQuery(invitationEntryOptions(params.token));
    if (entry.authenticated) {
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
  const clearInvitations = () => client.removeQueries({ queryKey: invitationKeys.all });
  const verify = useMutation({
    mutationFn: verifyFace,
    onSuccess: clearInvitations,
  });
  const open = useMutation({
    mutationFn: openInvitation,
    onSuccess: async () => {
      clearInvitations();
      await navigate({ to: '/i/$token/invitation', params: { token } });
    },
  });
  if (verify.error instanceof FaceMismatchError) {
    return (
      <SecretScene>
        <SelfDestruct />
      </SecretScene>
    );
  }
  if (verify.isSuccess) {
    return (
      <SecretScene>
        <SecretPaper className="secret-success">
          <SecretStamp>VERIFIED</SecretStamp>
          <h1 className="secret-result" aria-live="polite">
            It’s you, {entry.name}.
          </h1>
        </SecretPaper>
        <Button
          size="lg"
          onClick={() => navigate({ to: '/i/$token/invitation', params: { token } })}
        >
          Open invitation
        </Button>
      </SecretScene>
    );
  }
  if (!entry.faceScanRequired) {
    return (
      <SecretScene>
        <PersonalInvitationCover name={entry.name} />
        {open.error && (
          <p role="alert" className="secret-error">
            {open.error.message}
          </p>
        )}
        <Button size="lg" disabled={open.isPending} onClick={() => open.mutate(token)}>
          {open.isPending ? 'Opening invitation…' : 'Open invitation'}
        </Button>
      </SecretScene>
    );
  }
  return (
    <SecretScene>
      <SelfieCamera
        name={entry.name}
        onRetake={() => verify.reset()}
        onVerify={(photo) => verify.mutate({ token, photo })}
        pending={verify.isPending}
        error={verify.error?.message}
      />
    </SecretScene>
  );
}
