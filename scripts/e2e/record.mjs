#!/usr/bin/env node
/**
 * Record what the e2e tests replay. Runs every spec, logged in, against a real backend through a read-only
 * proxy that keeps the API responses (scripts/e2e/record-proxy.mjs), then cleans them up into
 * cypress/recordings/ with scrub-har.mjs. One recording per mode the environment is set up for:
 *
 *   HARVESTER_IP=10.0.0.1 HARVESTER_PASSWORD=... yarn e2e:record
 *     standalone Harvester -> recordings/standalone.{har,json}
 *   RANCHER_URL=https://rancher.example.com RANCHER_PASSWORD=... HARVESTER_CLUSTER=my-harvester yarn e2e:record
 *     the Harvester extension in a Rancher that has the Harvester imported -> recordings/rancher.{har,json}
 *
 * - HARVESTER_USERNAME / RANCHER_USERNAME default to admin. The Harvester needs at least one running VM
 * - HARVESTER_CLUSTER is the name or id of the Harvester cluster in that Rancher
 * - SCRUB_RENAME, SCRUB_CHECK are passed on to scrub-har.mjs, which also checks that the backend's address
 *   and the password are gone
 * - TEST_TIMEOUT (default 60000), RECORD_BROWSER (default electron), RECORD_KEEP_RAW=true keeps the
 *   unscrubbed recording for debugging
 *
 * `yarn e2e:record --serve standalone|rancher` only starts the dev server through the proxy, to look around.
 * The dev server runs on 8005, so that port must be free. Nothing is written for a mode whose specs fail.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startRecordingProxy } from './record-proxy.mjs';

/* eslint-disable no-console */

const DEV_URL = 'https://127.0.0.1:8005';
const PROXY_PORT = 8989;
const RECORDINGS = 'cypress/recordings';
const env = process.env;
const toUrl = (address) => new URL(address.includes('://') ? address : `https://${ address }`);
const modes = [];

if (env.HARVESTER_IP) {
  modes.push({
    name: 'standalone', target: toUrl(env.HARVESTER_IP), username: env.HARVESTER_USERNAME || 'admin', password: env.HARVESTER_PASSWORD, rancherEnv: 'harvester'
  });
}
if (env.RANCHER_URL) {
  modes.push({
    name: 'rancher', target: toUrl(env.RANCHER_URL), username: env.RANCHER_USERNAME || 'admin', password: env.RANCHER_PASSWORD, cluster: env.HARVESTER_CLUSTER
  });
}

const serveIndex = process.argv.indexOf('--serve');
const serve = serveIndex >= 0 ? (process.argv[serveIndex + 1] || modes[0]?.name) : undefined;

if (!modes.length || modes.some((m) => !m.password) || modes.some((m) => m.name === 'rancher' && !m.cluster)) {
  console.error('Set HARVESTER_IP and HARVESTER_PASSWORD, and/or RANCHER_URL, RANCHER_PASSWORD and HARVESTER_CLUSTER');
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harvester-record-'));
const children = new Set();
let proxy;

const stopAll = () => {
  children.forEach((child) => {
    try {
      process.kill(-child.pid);
    } catch {}
  });
  children.clear();
  proxy?.close();
  proxy = undefined;
};

const finish = (code) => {
  stopAll();
  if (env.RECORD_KEEP_RAW === 'true') {
    console.log(`Unscrubbed recordings kept in ${ tmp }: they hold secrets, delete them when done`);
  } else {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(code);
};

process.on('SIGINT', () => finish(1));

const run = (command, args, extraEnv, stdio) => {
  const child = spawn(command, args, {
    env: { ...env, ...extraEnv }, stdio, detached: true
  });

  children.add(child);
  child.on('exit', () => children.delete(child));

  return child;
};

const exited = (child) => new Promise((resolve) => child.on('exit', resolve));

const portInUse = (port) => new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1', () => {
    socket.end();
    resolve(true);
  });

  socket.on('error', () => resolve(false));
});

const devServerUp = () => new Promise((resolve) => {
  https.get(DEV_URL, { rejectUnauthorized: false, timeout: 30000 }, (res) => {
    res.resume();
    resolve(res.statusCode === 200);
  }).on('error', () => resolve(false)).on('timeout', function() {
    this.destroy();
    resolve(false);
  });
});

/**
 * Log in to Rancher's API, run `fn` with the token, log out
 */
async function withRancherToken(mode, fn) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const base = `${ mode.target.protocol }//${ mode.target.host }`;
  const providers = await fetch(`${ base }/v3-public/authProviders`, { headers: { accept: 'application/json' } });
  const csrf = (providers.headers.get('set-cookie') || '').match(/CSRF=([^;]+)/)?.[1];
  const login = await fetch(`${ base }/v3-public/localProviders/local?action=login`, {
    method:  'POST',
    headers: {
      'content-type': 'application/json', accept: 'application/json', cookie: `CSRF=${ csrf }`, 'x-api-csrf': csrf
    },
    body: JSON.stringify({
      username: mode.username, password: mode.password, responseType: 'json', description: 'e2e recording'
    })
  });

  if (login.status >= 300) {
    throw new Error(`logging in to ${ base } failed with ${ login.status }`);
  }
  const headers = { authorization: `Bearer ${ (await login.json()).token }`, accept: 'application/json' };

  try {
    return await fn((url) => fetch(`${ base }${ url }`, { headers }).then((r) => r.json()));
  } finally {
    await fetch(`${ base }/v3/tokens?action=logout`, { method: 'POST', headers });
  }
}

async function startDevServer(mode) {
  if (await portInUse(8005)) {
    throw new Error('port 8005 is in use: stop the other dev server first');
  }
  proxy = await startRecordingProxy(mode.target, PROXY_PORT, { hideUiPlugins: mode.name === 'rancher' });

  const log = path.join(tmp, `dev-server-${ mode.name }.log`);
  const fd = fs.openSync(log, 'a');

  console.log(`[${ mode.name }] dev server through a read-only proxy to ${ mode.target.origin } (log: ${ log })`);
  run('yarn', ['dev'], { API: `http://127.0.0.1:${ PROXY_PORT }`, RANCHER_ENV: mode.rancherEnv || '' }, ['ignore', fd, fd]);

  const deadline = Date.now() + 15 * 60 * 1000;

  while (!await devServerUp()) {
    if (Date.now() > deadline) {
      throw new Error(`the dev server did not start, see ${ log }`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function record(mode) {
  let clusterId = 'local';
  let clusters = [];

  if (mode.name === 'rancher') {
    [clusterId, clusters] = await withRancherToken(mode, async(get) => {
      const all = (await get('/v1/management.cattle.io.clusters')).data;
      const cluster = all.find((c) => c.id === mode.cluster || c.spec?.displayName === mode.cluster);

      if (!cluster) {
        throw new Error(`no cluster ${ mode.cluster } in ${ mode.target.origin }`);
      }

      return [cluster.id, ['local', cluster.id]];
    });
  }

  await startDevServer(mode);

  const valuesFile = path.join(tmp, `values-${ mode.name }.json`);

  console.log(`[${ mode.name }] running the specs on cluster ${ clusterId }`);
  const cypress = run('./node_modules/.bin/cypress', ['run', '--browser', env.RECORD_BROWSER || 'electron'], {
    TEST_BASE_URL:          DEV_URL,
    TEST_RECORD:            'true',
    TEST_RECORD_VALUES:     valuesFile,
    TEST_HARVESTER_MODE:    mode.name,
    TEST_HARVESTER_CLUSTER: clusterId,
    TEST_A11Y:              'true',
    TEST_SKIP:              'setup',
    TEST_NO_VIDEOS:         'true',
    // A live backend can take 20 s or more to load a page, more than replays need
    TEST_TIMEOUT:           env.TEST_TIMEOUT || '60000',
    TEST_USERNAME:          mode.username,
    TEST_PASSWORD:          mode.password,
  }, 'inherit');
  const passed = await exited(cypress) === 0;
  const { entries } = proxy;

  stopAll();
  if (!passed) {
    console.error(`[${ mode.name }] some specs failed against ${ mode.target.origin }, nothing written`);

    return false;
  }

  const rawHar = path.join(tmp, `${ mode.name }.har`);

  fs.writeFileSync(rawHar, JSON.stringify({ log: { version: '1.2', creator: { name: 'harvester-ui-extension record', version: '1' }, entries } }));

  const scrub = run(process.execPath, ['scripts/e2e/scrub-har.mjs', rawHar, path.join(RECORDINGS, `${ mode.name }.har`)], {
    SCRUB_CHECK:    [env.SCRUB_CHECK, mode.target.hostname, mode.password].filter(Boolean).join(','),
    SCRUB_CLUSTERS: clusters.join(','),
  }, 'inherit');

  if (await exited(scrub) !== 0) {
    console.error(`[${ mode.name }] the recording was not cleaned up, nothing written. RECORD_KEEP_RAW=true keeps it for a look`);

    return false;
  }

  // The values the specs check, renamed like the recording
  const renames = (env.SCRUB_RENAME || '').split(',').filter(Boolean).map((pair) => pair.split(':'));
  const settings = entries.find((e) => /\/harvesterhci\.io\.settings\?/.test(e.request.url));
  const version = settings && JSON.parse(settings.response.content.text).data?.find((s) => s.id === 'server-version')?.value;
  const values = {
    harvesterVersion: version, recordedAt: new Date().toISOString().slice(0, 10), clusterId, ...JSON.parse(fs.readFileSync(valuesFile, 'utf8'))
  };
  const json = renames.reduce((text, [from, to]) => text.split(from).join(to), JSON.stringify(values, null, 2));

  fs.writeFileSync(path.join(RECORDINGS, `${ mode.name }.json`), `${ json }\n`);
  console.log(`[${ mode.name }] recorded ${ version || 'Harvester' } into ${ RECORDINGS }/${ mode.name }.{har,json}`);

  return true;
}

try {
  if (serve) {
    const mode = modes.find((m) => m.name === serve);

    if (!mode) {
      throw new Error(`--serve ${ serve }: set up the environment for that mode first`);
    }
    await startDevServer(mode);
    console.log(`Serving ${ DEV_URL } through the read-only proxy, Ctrl+C to stop. Nothing is recorded`);
    await new Promise(() => {});
  }

  let ok = true;

  for (const mode of modes) {
    ok = await record(mode) && ok;
  }
  if (ok) {
    console.log('Look through the diff before committing');
  }
  finish(ok ? 0 : 1);
} catch (e) {
  console.error(e.message);
  finish(1);
}
