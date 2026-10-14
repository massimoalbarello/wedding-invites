import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  FaceMismatchError,
  invitationEntryOptions,
  invitationKeys,
  openInvitation,
  verifyFace,
} from '../queries/invitations';
import { SecretScene } from './-invitation/secret-paper';
import { SelfDestruct } from './-invitation/self-destruct';
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
    onSuccess: () => {
      client.removeQueries({ queryKey: invitationKeys.all });
      return navigate({ to: '/i/$token/invitation', params: { token }, replace: true });
    },
  });
  if (verify.error instanceof FaceMismatchError) {
    return (
      <SecretScene>
        <SelfDestruct />
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
