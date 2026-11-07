import { Elysia, StatusMap } from 'elysia';
import { InvitationParamsSchema } from '#backend/routes/api/invitations/model.ts';
import type { FrontendAssetsServiceContract } from '#backend/services/frontend-assets/service.ts';
import type { GuestAccessServiceContract } from '#backend/services/invitations/guest-access.ts';

export function createInvitationPagesController(input: {
  access: GuestAccessServiceContract;
  frontend: FrontendAssetsServiceContract;
}) {
  const app = new Elysia();
  for (const route of ['/i/:token', '/i/:token/invitation']) {
    app.get(
      route,
      async ({ params, path, status }) => {
        const page = input.frontend.fallback(path);
        if (!page) {
          return status('Not Found', { error: 'Not Found' });
        }
        page.headers.set('Cache-Control', 'private, no-store');
        const title = await input.access.preview(params.token);
        if (!title) {
          return new Response(page.body, { status: StatusMap['Not Found'], headers: page.headers });
        }
        return new HTMLRewriter()
          .on('title', {
            element(element) {
              element.setInnerContent(title);
            },
          })
          .on('head', {
            element(element) {
              element.append(
                `<meta name="description" content="${title}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${title}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${title}">`,
                { html: true },
              );
            },
          })
          .transform(page);
      },
      { params: InvitationParamsSchema, detail: { hide: true } },
    );
  }
  return app;
}
