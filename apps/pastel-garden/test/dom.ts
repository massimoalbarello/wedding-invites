import { mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:3000' });

// Happy DOM has no canvas renderer; the real particle flight is exercised in the browser.
mock.module('canvas-confetti', () => ({
  default: {
    create: () => Object.assign(() => new Promise<undefined>(() => {}), { reset: () => {} }),
  },
}));
