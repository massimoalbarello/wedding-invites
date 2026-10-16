import { buttonVariants } from '@repo/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  FaceMismatchError,
  invitationEntryOptions,
  invitationKeys,
  openInvitation,
  verifyFace,
} from '../queries/invitations';
import { SecretPaper, SecretScene, SecretSeal, SecretStamp } from './-invitation/secret-paper';
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
  const clearInvitations = () => client.removeQueries({ queryKey: invitationKeys.all });
  const verify = useMutation({
    mutationFn: verifyFace,
    onSuccess: clearInvitations,
  });
  if (verify.error instanceof FaceMismatchError) {
    return (
      <SecretScene>
        <SelfDestruct />
      </SecretScene>
    );
  }
  if (verify.isSuccess) {
    return <VerifiedInvitation key={token} token={token} name={entry.name} />;
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

const OPEN_DELAY_SECONDS = 3;
const SECOND_MS = 1000;

function VerifiedInvitation({ token, name }: { token: string; name: string }) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(OPEN_DELAY_SECONDS);
  useEffect(() => {
    const deadline = Date.now() + OPEN_DELAY_SECONDS * SECOND_MS;
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / SECOND_MS)));
    }, SECOND_MS);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setSeconds(0);
      void navigate({ to: '/i/$token/invitation', params: { token }, replace: true });
    }, OPEN_DELAY_SECONDS * SECOND_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate, token]);
  return (
    <SecretScene>
      <SecretPaper className="secret-success">
        <div className="secret-topline">
          <p className="secret-eyebrow">Identity confirmed</p>
          <SecretSeal verified />
        </div>
        <SecretStamp>
          ACCESS
          <br />
          GRANTED
        </SecretStamp>
        <h1 className="secret-title" aria-live="polite">
          It’s you, {name}.
        </h1>
        <p className="secret-success-note">Your invitation awaits.</p>
      </SecretPaper>
      <p className="secret-opening" role="status" aria-live="polite" aria-atomic="true">
        <span className="secret-timer" aria-hidden="true">
          {seconds || '↗'}
        </span>
        {seconds > 0 ? `Opening your invitation in ${seconds}…` : 'Opening your invitation…'}
      </p>
      <Link
        className={buttonVariants({ variant: 'link', size: 'lg', className: 'mt-5 min-h-12 px-6' })}
        to="/i/$token/invitation"
        params={{ token }}
        replace
      >
        Open invitation
        <span aria-hidden="true">↗</span>
      </Link>
    </SecretScene>
  );
}
