import { cn } from '@repo/ui/class-names';
import type { ReactNode } from 'react';

export function SecretScene({ children }: { children: ReactNode }) {
  return <main className="secret-entry">{children}</main>;
}

export function SecretPaper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('secret-mail', className)}>
      <div className="secret-backing" aria-hidden="true" />
      <section className="secret-paper">{children}</section>
    </div>
  );
}

export function SecretStamp({ children }: { children: ReactNode }) {
  return <div className="secret-stamp">{children}</div>;
}

export function PersonalInvitationCover({ name }: { name: string }) {
  return (
    <SecretPaper>
      <SecretStamp>
        TOP
        <br />
        SECRET
      </SecretStamp>
      <div className="secret-recipient">
        <p>A personal invitation for</p>
        <h1>{name}</h1>
      </div>
    </SecretPaper>
  );
}
