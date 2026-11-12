import { extendConfig } from '@rancher/cypress/extend-config';

// The suite runs against `yarn dev` replaying a recorded Harvester (see cypress/README.md), so there
// is no backend to log in to. The dev server rewrites the recorded links to 127.0.0.1, so use the
// same host for the pages.
export default extendConfig({
  e2e: {
    baseUrl:     (process.env.TEST_BASE_URL || 'https://127.0.0.1:8005').replace(/\/$/, ''),
    supportFile: './cypress/support/e2e.ts',
  }
});
