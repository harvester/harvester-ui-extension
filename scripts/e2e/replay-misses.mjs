#!/usr/bin/env node
/**
 * List the API requests the replayed Harvester had no recording for, from the dev server's log, as Markdown
 * for the GitHub job summary. A spec that fails for no clear reason after a change usually needs a new
 * recording (`yarn e2e:record`) when this list isn't empty.
 *
 *   node scripts/e2e/replay-misses.mjs dev-server.log >> "$GITHUB_STEP_SUMMARY"
 */
import fs from 'node:fs';

const file = process.argv[2] || 'dev-server.log';

if (!fs.existsSync(file)) {
  process.exit(0);
}

// eslint-disable-next-line no-control-regex
const log = fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
const misses = new Set([
  // The shell's HAR replay answers 404 for /v1, /v3 and /k8s requests it has no recording for
  ...[...log.matchAll(/^(GET|POST|PUT|PATCH|DELETE)\? 404 (.+)$/gm)].map(([, method, url]) => `${ method } ${ url }`),
  // Anything else goes on to the API, which is not there. Live update sockets are expected to
  ...[...log.matchAll(/Error occurred while proxying request [^/]+(\/\S+)/g)].map(([, url]) => url).filter((url) => !/\/subscribe\?/.test(url)),
]);

const lines = ['### Replayed Harvester', ''];

if (misses.size) {
  lines.push(`${ misses.size } request(s) had no recording. If a spec failed because of them, run \`yarn e2e:record\` (see cypress/README.md):`, '');
  [...misses].sort().forEach((miss) => lines.push(`- \`${ miss }\``));
} else {
  lines.push('Every request was answered from the recording.');
}

console.log(lines.join('\n')); // eslint-disable-line no-console
