# Wedding invites

Wedding invitations with a private guest dashboard, personal links, face verification, and RSVPs. Set your couple names and ceremony date in the dashboard.

[![Deploy to nibrun](.github/assets/deploy-your-own.svg)](https://app.nibrun.com/deploy?name=wedding-invites&binary=https%3A%2F%2Fgithub.com%2Fmassimoalbarello%2Fwedding-invites%2Freleases%2Fdownload%2Fnibrun-latest%2Fapp&port=3000&minimal)

CI builds and tests the Linux executable, then publishes it to the [latest prerelease](https://github.com/massimoalbarello/wedding-invites/releases/tag/nibrun-latest) after successful pushes to `main`. The button deploys that build. Create the owner passkey before sharing the app.

## Local development

Requires Bun 1.4, Node 24, CMake 3.24+, and a C++ compiler. Browser tests also need FFmpeg; Linux builds need Docker.

```sh
bun install --frozen-lockfile
bun run install:browser
bun run dev:isolated:seeded
```

This opens a disposable dashboard with sample guests. The first run builds the face engine and downloads its models.

## Checks and builds

```sh
bun run check:all
bun run test
bun run test:browser
bun run build:linux
```

The deployable binary is `apps/web/dist/app`. Based on [bun-full-stack-template](https://github.com/massimoalbarello/bun-full-stack-template).
