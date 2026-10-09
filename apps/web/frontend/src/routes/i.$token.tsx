import { Button } from '@repo/ui/button';
import { createFileRoute, type ErrorComponentProps, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/i/$token')({
  component: () => <Outlet />,
  errorComponent: ({ error, reset }: ErrorComponentProps) => (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="font-semibold text-2xl tracking-tight">This message couldn’t be opened</h1>
      <p className="mt-4 text-muted-foreground">
        {error instanceof Error ? error.message : 'Please try opening your personal link again.'}
      </p>
      <Button variant="link" onClick={reset} className="mt-6">
        Try again
      </Button>
    </main>
  ),
});
