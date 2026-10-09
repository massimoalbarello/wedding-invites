import { Button } from '@repo/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { signOut } from '../queries/session';

export function AdminLayout({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      client.clear();
      await navigate({ to: '/login' });
    },
  });
  return (
    <div className="min-h-dvh">
      <header className="flex h-18 items-center justify-between border-border border-b px-5 sm:px-10">
        <Link
          to="/"
          aria-label="Guest list"
          className="flex items-center gap-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-serif text-primary-foreground">
            ✉
          </span>
          <span className="hidden sm:inline">Invitation dashboard</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" render={<Link to="/settings" />}>
            Wedding settings
          </Button>
          <Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}>
            Sign out
          </Button>
        </div>
      </header>
      {logout.error && (
        <p role="alert" className="px-5 py-3 text-destructive text-sm">
          {logout.error.message}
        </p>
      )}
      {children}
    </div>
  );
}
