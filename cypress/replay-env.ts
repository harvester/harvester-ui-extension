// @rancher/cypress's config reads these when it loads, and expects a live Rancher. Give it the replay's:
// the dev server on 127.0.0.1, no setup specs, and no login. A recording sets the real password
process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || 'https://127.0.0.1:8005';
process.env.TEST_SKIP = process.env.TEST_SKIP || 'setup';

if (process.env.TEST_RECORD !== 'true') {
  process.env.TEST_PASSWORD = process.env.TEST_PASSWORD || 'not-used-by-replays';
}

export {};
