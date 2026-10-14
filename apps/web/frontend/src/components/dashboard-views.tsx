import { Button } from '@repo/ui/button';
import { Link, useLocation } from '@tanstack/react-router';

export function DashboardViews() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const selectedView = pathname === '/design' ? '/design' : '/';
  return (
    <nav aria-label="Dashboard views" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
      {[
        { to: '/design', label: 'Invitation design' },
        { to: '/', label: 'Guest list' },
      ].map(({ to, label }) => (
        <Button
          key={to}
          variant={selectedView === to ? 'outline' : 'ghost'}
          render={<Link to={to} activeOptions={{ exact: true }} />}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}
