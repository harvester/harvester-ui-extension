#!/usr/bin/env node
/**
 * Turn a HAR recorded against a real Harvester into a fixture that is safe to commit and that the
 * shell's dev server can replay (`HAR_FILE=... yarn dev`, see @rancher/shell/server/har-file.js).
 *
 *   [SCRUB_RENAME="from:to,..."] [SCRUB_CHECK="a,b"] node scripts/e2e/scrub-har.mjs <recorded.har> <fixture.har>
 *
 * What it does:
 * - keeps only API calls (/v1, /v3, /k8s, ...) with a JSON or text response, and only the last
 *   response per method + URL, so replay does not depend on the order pages are visited in
 * - drops request headers, cookies and bodies, and every response header except content-type
 * - rewrites the recording host to https://harvester.invalid (the shell maps it back to the dev server)
 * - keeps Secrets, ConfigMaps, Pods and ServiceAccounts only from namespaces that hold a VM, and with
 *   SCRUB_CLUSTERS="local,c-abcde" only those clusters in Rancher's cluster lists, and only system
 *   namespaces in Rancher's own namespace list and counts
 * - drops personal preferences (saved views, dashboards) and the install's id
 * - redacts Secret data, password/token-like fields and settings, cloud-init passwords, PEM blocks,
 *   SSH keys, e-mail addresses and Rancher import URLs, maps every IP address to documentation
 *   ranges and internal host names to example.com, and removes last-applied-configuration annotations
 *   and managedFields
 * - SCRUB_RENAME="from:to,..." renames resources whose names give away people or internal systems,
 *   everywhere they appear (names, ids, links, references)
 * - fails if anything that looks sensitive is still there; SCRUB_CHECK adds comma-separated strings
 *   that must not appear (e.g. the admin password). Both are read from the environment, never printed
 */
import fs from 'node:fs';

const BASE = 'https://harvester.invalid';
const LANDING = `${ BASE }/dashboard/harvester/c/local/harvesterhci.io.dashboard`;
const API_PATH = /^\/(v1|v1-public|v3|v3-public|k8s|meta|api|apis|rancherversion|version)(\/|\?|$)/;
const DROP_PATH = /^\/v3\/tokens|^\/v1\/ext\.cattle\.io\.tokens|generateKubeconfig|^\/v3-public\/localProviders|^\/v1-public\/login/;
const NAMESPACED_TRIM = ['secret', 'configmap', 'pod', 'serviceaccount'];
const CLUSTER_TRIM = ['management.cattle.io.cluster', 'provisioning.cattle.io.cluster', 'harvesterhci.io.management.cluster'];
const PUBLIC_SUSE_HOSTS = ['registry.suse.com', 'www.suse.com', 'documentation.suse.com', 'scc.suse.com', 'docs.harvesterhci.io'];
const REDACTED = 'REDACTED';
const REDACTED_B64 = Buffer.from(REDACTED).toString('base64');
const DUMMY_SSH_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHRlc3Qta2V5LWZvci1lMmUtZml4dHVyZXMtb25seQ user@example.com';

const SENSITIVE_KEY = /pass(word|wd)|private.?key|access.?key|secret.?key|api.?key|^(token|secret|credentials?)$|_(token|secret)$/i;
const SENSITIVE_ENV_NAME = /pass(word|wd)|secret|token|private.?key|access.?key|api.?key/i;
// Settings replaced in the recording: secrets and ids of the recorded install, and Rancher's dynamic
// content, which would otherwise make every replay call the recorded install's content endpoint
const SETTING_OVERRIDES = {
  'cluster-registration-url': '', 'install-uuid': '', 'ui-content-enabled': 'false', 'ui-content-endpoint': ''
};

// Preferences that are personal content rather than how pages behave
const PREFERENCE_DROP = ['custom-dashboards', 'configurable-views-saved', 'table-views', 'resource-table-views', 'last-namespace'];
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const [input, output] = process.argv.slice(2);
const extraChecks = (process.env.SCRUB_CHECK || '').split(',').filter(Boolean);
const renames = (process.env.SCRUB_RENAME || '').split(',').filter(Boolean).map((pair) => pair.split(':'));
const keepClusters = (process.env.SCRUB_CLUSTERS || '').split(',').filter(Boolean);
// Rancher's own namespaces name whatever else runs there: keep the system ones and the kept clusters'
const keepRancherNamespace = (ns) => /^(default|local|kube-|cattle-|fleet-)/.test(ns) || keepClusters.some((c) => ns === c || ns.startsWith(`${ c }-`));

if (!input || !output) {
  console.error('usage: [SCRUB_RENAME="from:to"] [SCRUB_CHECK="a,b"] scrub-har.mjs <recorded.har> <fixture.har>'); // eslint-disable-line no-console
  process.exit(2);
}

// A HAR with the dev build's JavaScript in it goes past what JSON.parse can read
if (fs.statSync(input).size > 400e6) {
  console.error(`${ input } is too big: filter the Network panel to Fetch/XHR before exporting`); // eslint-disable-line no-console
  process.exit(2);
}

const har = JSON.parse(fs.readFileSync(input, 'utf8'));
const recordHost = new URL(har.log.entries.find((e) => API_PATH.test(new URL(e.request.url).pathname)).request.url).origin;

// Consistent replacement maps, so the same IP or host is always rewritten to the same value
const ipMap = new Map();
const hostMap = new Map();
const ipPools = ['198.51.100', '203.0.113', '192.0.2'];
// Addresses that identify nothing: loopback, "any", netmasks and the documentation ranges used above
const KEEP_IP = /^(127\.0\.0\.1|0\.0\.0\.0|255\.\d+\.\d+\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|192\.0\.2\.\d+)$/;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

const mapIp = (ip) => {
  if (KEEP_IP.test(ip)) {
    return ip;
  }
  if (!ipMap.has(ip)) {
    const n = ipMap.size;

    ipMap.set(ip, `${ ipPools[Math.floor(n / 254) % ipPools.length] }.${ (n % 254) + 1 }`);
  }

  return ipMap.get(ip);
};

const mapHost = (host) => {
  if (PUBLIC_SUSE_HOSTS.includes(host.toLowerCase())) {
    return host;
  }
  if (!hostMap.has(host)) {
    hostMap.set(host, `host${ hostMap.size + 1 }.example.com`);
  }

  return hostMap.get(host);
};

const rename = (s) => renames.reduce((acc, [from, to]) => acc.split(from).join(to), s);

const scrubString = (s) => rename(s)
  .split(recordHost).join(BASE)
  .split(recordHost.replace('https://', 'wss://')).join(BASE.replace('https://', 'wss://'))
  .replace(/-----BEGIN ([A-Z ]+)-----[\s\S]*?-----END \1-----/g, (_, kind) => `-----BEGIN ${ kind }-----\n${ REDACTED }\n-----END ${ kind }-----`)
  .replace(/ssh-(rsa|ed25519|dss|ecdsa-sha2-nistp\d+) [A-Za-z0-9+/=]+( [^\s"\\]+)?/g, DUMMY_SSH_KEY)
  .replace(/((?:^|\\n|\n)\s*-?\s*(?:password|passwd|plain_text_passwd|hashed_passwd)\s*:\s*)[^\\\n"]+/gi, `$1${ REDACTED }`)
  .replace(/https?:\/\/[^\s"\\]+\/v3\/import\/[a-z0-9]+(_[a-z0-9-]+)?\.yaml/g, `https://rancher.example.com/v3/import/${ REDACTED }.yaml`)
  .replace(IPV4, mapIp)
  .replace(/\b[a-z0-9.-]+\.(suse\.(com|de|cz|cloud)|ui\.rancher\.space)\b/gi, mapHost)
  .replace(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/gi, (m) => (m.endsWith('@example.com') ? m : 'user@example.com'));

const typeOf = (obj) => (obj?.type || obj?.kind || '').toString().toLowerCase();

function scrubValue(value, key) {
  if (typeof value === 'string') {
    return SENSITIVE_KEY.test(key || '') && value ? REDACTED : scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const out = {};

  for (const [k, v] of Object.entries(value)) {
    out[scrubString(k)] = scrubValue(v, k);
  }

  // Secret data never leaves the recording machine
  if (typeOf(value) === 'secret') {
    for (const field of ['data', 'stringData']) {
      if (out[field] && typeof out[field] === 'object') {
        out[field] = Object.fromEntries(Object.keys(out[field]).map((k) => [k, field === 'data' ? REDACTED_B64 : REDACTED]));
      }
    }
  }

  // Env vars and similar { name, value } pairs
  if (typeof out.name === 'string' && typeof out.value === 'string' && SENSITIVE_ENV_NAME.test(out.name)) {
    out.value = REDACTED;
  }

  // Harvester / Rancher settings keep JSON in `value` and `default`
  if (/setting$/.test(typeOf(value)) || /\.settings?$/.test(typeOf(value))) {
    const id = value.id || value.metadata?.name;

    if (id in SETTING_OVERRIDES) {
      out.value = SETTING_OVERRIDES[id];
      // steve repeats the value in the printer columns
      if (Array.isArray(out.metadata?.fields)) {
        out.metadata.fields = out.metadata.fields.map((f, i) => (i === 0 ? f : SETTING_OVERRIDES[id]));
      }
    }

    for (const field of ['value', 'default']) {
      if (typeof out[field] !== 'string' || !out[field] || id in SETTING_OVERRIDES) {
        continue;
      }
      try {
        const parsed = JSON.parse(out[field]);

        if (parsed && typeof parsed === 'object') {
          out[field] = JSON.stringify(scrubValue(parsed));
        }
      } catch {}
    }
  }

  if (typeOf(value) === 'userpreference' && out.data && typeof out.data === 'object') {
    PREFERENCE_DROP.forEach((pref) => delete out.data[pref]);
    if (keepClusters.length) {
      if (out.data.cluster && !keepClusters.includes(out.data.cluster)) {
        out.data.cluster = 'local';
      }
      for (const pref of ['recent-clusters', 'pinned-clusters', 'ns-by-cluster']) {
        try {
          const parsed = JSON.parse(out.data[pref]);

          out.data[pref] = JSON.stringify(Array.isArray(parsed) ? parsed.filter((id) => keepClusters.includes(id)) : Object.fromEntries(Object.entries(parsed).filter(([id]) => keepClusters.includes(id))));
        } catch {}
      }
    }
  }

  if (out.metadata?.annotations) {
    delete out.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
  }
  // Server-side apply bookkeeping: nothing the UI shows, and bulky
  if (out.metadata?.managedFields) {
    delete out.metadata.managedFields;
  }

  return out;
}

// Last response per method + URL
const latest = new Map();

for (const e of har.log.entries) {
  const url = new URL(e.request.url);
  const mime = (e.response.content?.mimeType || '').split(';')[0];

  if (!API_PATH.test(url.pathname) || DROP_PATH.test(url.pathname + url.search)) {
    continue;
  }
  if (!['application/json', 'text/plain'].includes(mime) || typeof e.response.content?.text !== 'string') {
    continue;
  }
  if (e.response.content.encoding === 'base64') {
    e.response.content.text = Buffer.from(e.response.content.text, 'base64').toString('utf8');
  }

  latest.set(`${ e.request.method } ${ url.pathname }${ url.search }`, { e, url, mime });
}

// Lists of cluster ids in a query (the cluster menu asks for the pinned clusters) keep only the kept
// clusters, as the trimmed preferences make the replayed UI ask
const keptClusterIds = (search) => (keepClusters.length ? search.replace(/,id=%22(c-[a-z0-9-]+)%22/g, (match, id) => (keepClusters.includes(id) ? match : '')) : search);

// The install's id is in its settings and in the cluster agents' environment
for (const { e, url } of latest.values()) {
  if (/management\.cattle\.io\.settings$/.test(url.pathname)) {
    try {
      const uuid = JSON.parse(e.response.content.text).data?.find((setting) => setting.id === 'install-uuid')?.value;

      if (uuid) {
        renames.push([uuid, ZERO_UUID]);
      }
    } catch {}
  }
}

// Namespaces that hold a VM: the only ones whose Secrets, ConfigMaps, Pods and ServiceAccounts we keep
const vmNamespaces = new Set();

for (const { e, url } of latest.values()) {
  if (/kubevirt\.io\.virtualmachines$/.test(url.pathname)) {
    try {
      JSON.parse(e.response.content.text).data?.forEach((vm) => vmNamespaces.add(vm.metadata?.namespace));
    } catch {}
  }
}

const entries = [];
let trimmed = 0;

for (const { e, url, mime } of latest.values()) {
  let text = e.response.content.text;

  if (mime === 'application/json') {
    try {
      let body = JSON.parse(text);

      if (body?.type === 'collection' && Array.isArray(body.data) && NAMESPACED_TRIM.includes(body.resourceType)) {
        const before = body.data.length;

        body.data = body.data.filter((item) => vmNamespaces.has(item.metadata?.namespace));
        trimmed += before - body.data.length;
        if (typeof body.count === 'number') {
          body.count = body.data.length;
        }
      }
      if (keepClusters.length && body?.type === 'collection' && Array.isArray(body.data) && CLUSTER_TRIM.includes(body.resourceType)) {
        const before = body.data.length;

        body.data = body.data.filter((item) => keepClusters.includes(item.id) || keepClusters.includes(item.status?.clusterName));
        trimmed += before - body.data.length;
        if (typeof body.count === 'number') {
          body.count = body.data.length;
        }
      }
      if (keepClusters.length && url.pathname === '/v1/namespaces' && Array.isArray(body?.data)) {
        const before = body.data.length;

        body.data = body.data.filter((ns) => keepRancherNamespace(ns.id));
        // steve's relationships of fleet-default and the like name every cluster's Fleet bundles
        body.data.forEach((ns) => delete ns.metadata?.relationships);
        trimmed += before - body.data.length;
        if (typeof body.count === 'number') {
          body.count = body.data.length;
        }
      }
      if (keepClusters.length && url.pathname === '/v1/counts' && Array.isArray(body?.data)) {
        body.data.forEach((count) => Object.values(count.counts || {}).forEach((type) => {
          Object.keys(type.namespaces || {}).filter((ns) => !keepRancherNamespace(ns)).forEach((ns) => delete type.namespaces[ns]);
        }));
      }
      body = scrubValue(body);
      text = JSON.stringify(body);
    } catch {
      text = scrubString(text);
    }
  } else {
    text = scrubString(text);
  }

  entries.push({
    pageref:         'page_1',
    startedDateTime: e.startedDateTime,
    time:            0,
    request:         {
      method: e.request.method, url: `${ BASE }${ scrubString(url.pathname + keptClusterIds(url.search)) }`, httpVersion: 'HTTP/1.1', headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1
    },
    response: {
      status:      e.response.status,
      statusText:  e.response.statusText,
      httpVersion: 'HTTP/1.1',
      headers:     [{ name: 'content-type', value: mime }],
      cookies:     [],
      content:     {
        size: text.length, mimeType: mime, text
      },
      redirectURL: '',
      headersSize: -1,
      bodySize:    -1
    },
    cache:   {},
    timings: {
      send: 0, wait: 0, receive: 0
    }
  });
}

entries.sort((a, b) => a.request.url.localeCompare(b.request.url) || a.request.method.localeCompare(b.request.method));

const fixture = {
  log: {
    version: '1.2',
    creator: { name: 'harvester-ui-extension scrub-har', version: '1' },
    pages:   [{
      id: 'page_1', title: LANDING, startedDateTime: entries[0]?.startedDateTime, pageTimings: {}
    }],
    entries
  }
};
const json = JSON.stringify(fixture, null, 1);

// Last line of defence: refuse to write anything that still looks sensitive, and say where it is
const LEAKS = {
  'recording host':     (text) => recordHost !== BASE && text.includes(new URL(recordHost).host),
  'private key':        (text) => /PRIVATE KEY-----(?![\\n]{0,4}REDACTED)/.test(text),
  'IP address':         (text) => (text.match(IPV4) || []).some((ip) => !KEEP_IP.test(ip)),
  'rancher import URL': (text) => /\/v3\/import\/(?!REDACTED)[a-z0-9]{20,}/.test(text),
  'internal host':      (text) => /\b[a-z0-9-]+\.[a-z0-9.-]*(suse\.(com|de|cz|cloud)|ui\.rancher\.space)\b/i.test(text.replace(/registry\.suse\.com|www\.suse\.com|documentation\.suse\.com|scc\.suse\.com/g, '')),
  'rancher token':      (text) => /token-[a-z0-9]{5}:[a-z0-9]{40,}/.test(text),
  jwt:                  (text) => /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text),
  'session cookie':     (text) => /R_SESS/.test(text),
  'last-applied':       (text) => text.includes('last-applied-configuration'),
  ...Object.fromEntries(extraChecks.map((s, i) => [`SCRUB_CHECK value #${ i + 1 }`, (text) => text.includes(s)])),
};
const found = Object.entries(LEAKS).map(([name, test]) => {
  const where = entries.filter((e) => test(`${ e.request.url } ${ e.response.content.text }`)).map((e) => `${ e.request.method } ${ e.request.url.replace(BASE, '') }`);

  return where.length ? `${ name } (${ where.slice(0, 3).join(', ') })` : undefined;
}).filter(Boolean);

if (found.length) {
  console.error(`Refusing to write ${ output }, still contains: ${ found.join('; ') }`); // eslint-disable-line no-console
  process.exit(1);
}

fs.writeFileSync(output, `${ json }\n`);
// eslint-disable-next-line no-console
console.log(`${ entries.length } responses, ${ (json.length / 1e6).toFixed(1) } MB, VM namespaces: ${ [...vmNamespaces].join(', ') }, ` +
  `${ trimmed } objects outside them dropped, ${ ipMap.size } IPs and ${ hostMap.size } host names rewritten`);
