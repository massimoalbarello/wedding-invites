import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({
  url: 'http://localhost:3000',
  settings: { disableIframePageLoading: true },
});
