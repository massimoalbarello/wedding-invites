import { Button } from '@repo/ui/button';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
  Outlet,
} from '@tanstack/react-router';
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  pendingComponent: () => (
    <main
      className="flex min-h-dvh items-center justify-center text-muted-foreground text-sm"
      aria-live="polite"
    >
      Just a moment…
    </main>
  ),
  errorComponent: ({ reset }: ErrorComponentProps) => (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-semibold text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground">We couldn’t load this page. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-semibold text-2xl">Page not found</h1>
      <p className="text-muted-foreground">
        Check the link you were sent and try opening it again.
      </p>
      <Link to="/" className="text-sm underline underline-offset-4">
        Go to the dashboard
      </Link>
    </main>
  ),
});
