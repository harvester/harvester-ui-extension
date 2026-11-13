// Before @rancher/cypress's config, which reads the environment when it loads
import './cypress/replay-env';
import fs from 'fs';
import baseConfig from '@rancher/cypress/base-config';
import { extendConfig } from '@rancher/cypress/extend-config';

// The suite runs against `yarn dev` replaying a recorded backend, with no login (see cypress/README.md):
// TEST_HARVESTER_MODE=standalone (default) replays a standalone Harvester, TEST_HARVESTER_MODE=rancher the
// Harvester extension in a Rancher. `yarn e2e:record` (scripts/e2e/record.mjs) runs it against a real
// backend instead, and sets TEST_RECORD, TEST_RECORD_VALUES and TEST_HARVESTER_CLUSTER
const recording = process.env.TEST_RECORD === 'true';
const harvesterMode = process.env.TEST_HARVESTER_MODE || 'standalone';
const recordedValues = `cypress/recordings/${ harvesterMode }.json`;
const harvesterCluster = process.env.TEST_HARVESTER_CLUSTER ||
  (fs.existsSync(recordedValues) ? JSON.parse(fs.readFileSync(recordedValues, 'utf8')).clusterId : undefined) ||
  'local';

// The dev server rewrites the recorded links to 127.0.0.1, so the pages use the same host
export default extendConfig({
  env: {
    recording, harvesterMode, harvesterCluster
  },
  e2e: {
    baseUrl:     (process.env.TEST_BASE_URL as string).replace(/\/$/, ''),
    supportFile: './cypress/support/e2e.ts',
    // A recording visits every page any spec needs, the accessibility ones included
    ...(recording ? { specPattern: 'cypress/e2e/tests/**/*.spec.ts' } : {}),
    async setupNodeEvents(on, config) {
      const result = await baseConfig.e2e?.setupNodeEvents?.(on, config);

      on('task', {
        saveRecordedValue({ key, value }: { key: string, value: unknown }) {
          const file = process.env.TEST_RECORD_VALUES as string;
          const values = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

          fs.writeFileSync(file, JSON.stringify({ ...values, [key]: value }, null, 2));

          return null;
        }
      });

      return result || config;
    },
  }
});
