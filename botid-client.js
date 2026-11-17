import { initBotId } from './vendor/botid-client-core.mjs';

// The static app has no framework runtime, so initialize BotID directly.
// These paths must stay aligned with the Vercel API handlers.
initBotId({
  protect: [
    { path: '/api/blob-upload', method: 'POST' },
    { path: '/api/blob-download', method: 'GET' },
  ],
});
