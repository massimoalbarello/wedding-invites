import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  invitationEntryOptions,
  invitationKeys,
  openInvitation,
  verifyFace,
} from '../queries/invitations';
import { SecretPaper, SecretScene, SecretStamp } from './-invitation/secret-paper';
import { SelfDestruct } from './-invitation/self-destruct';
import { SelfieCamera } from './-invitation/selfie-camera';

export const Route = createFileRoute('/i/$token/')({
  remountDeps: ({ params }) => params.token,
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
  const verify = useMutation({
    mutationFn: verifyFace,
    onSuccess: () => {
      client.removeQueries({ queryKey: invitationKeys.all });
    },
  });
  if (verify.isError) {
    return (
      <SecretScene>
        <SelfDestruct />
      </SecretScene>
    );
  }
  if (verify.isSuccess) {
    return <VerifiedMessage name={entry.name} token={token} />;
  }
  return (
    <SecretScene>
      <SelfieCamera
        name={entry.name}
        onVerify={(photo) => verify.mutate({ token, photo })}
        pending={verify.isPending}
      />
    </SecretScene>
  );
}

const COUNTDOWN_SECONDS = 3;
const SECOND_MS = 1000;
function VerifiedMessage({ name, token }: { name: string; token: string }) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  useEffect(() => {
    const deadline = Date.now() + COUNTDOWN_SECONDS * SECOND_MS;
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / SECOND_MS)));
    }, SECOND_MS);
    const open = setTimeout(() => {
      clearInterval(interval);
      setSeconds(0);
      void navigate({ to: '/i/$token/invitation', params: { token }, replace: true });
    }, COUNTDOWN_SECONDS * SECOND_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(open);
    };
  }, [navigate, token]);
  return (
    <SecretScene>
      <SecretPaper className="secret-success">
        <SecretStamp>VERIFIED</SecretStamp>
        <h1 className="secret-result">It’s you, {name}.</h1>
        <p className="secret-countdown" role="status" aria-live="polite">
          {seconds > 0 ? `Opening invitation in ${seconds}…` : 'Opening invitation…'}
        </p>
      </SecretPaper>
    </SecretScene>
  );
}
