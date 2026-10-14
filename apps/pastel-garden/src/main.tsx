import '@fontsource-variable/dm-sans';
import { createInvitationClient } from '@repo/invitation-runtime/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Invitation } from './invitation';
import './styles.css';

const runtime = createInvitationClient({ window });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Invitation runtime={runtime} />
    </QueryClientProvider>
  </StrictMode>,
);
