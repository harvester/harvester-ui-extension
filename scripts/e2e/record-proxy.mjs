/**
 * The proxy scripts/e2e/record.mjs puts between the dev server and a real Harvester or Rancher. It keeps
 * the API responses for the recording and is read-only: the UI's writes (preferences, ...) are answered
 * here with what was sent, so recording never changes the backend. Only logging in and out, and the
 * shell's user lookup (a POST that only reads), go through.
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

/* eslint-disable no-console */

const READS = ['GET', 'HEAD', 'OPTIONS'];
const WRITES_LET_THROUGH = /^\/v3-public\/localProviders\/local\?action=login|^\/v1-public\/login|^\/v3\/tokens\?action=logout|^\/v1\/ext\.cattle\.io\.selfuser/;
const KEPT_TYPES = ['application/json', 'text/plain'];

/**
 * Lock Rancher features off, in a features list or a single feature
 */
const featuresOff = (ids) => (text) => {
  try {
    const body = JSON.parse(text);

    (Array.isArray(body.data) ? body.data : [body]).filter((f) => ids.includes(f.id)).forEach((f) => {
      f.spec = { ...f.spec, value: false };
      f.status = { ...f.status, lockedValue: false };
    });

    return JSON.stringify(body);
  } catch {
    return text;
  }
};

/**
 * @param {URL} target the Harvester or Rancher
 * @param {object} options `asExtension` makes the dev server's Harvester behave as the extension does in
 * a real Rancher: /v1/uiplugins answers no extensions, so the Rancher's installed Harvester doesn't load
 * next to the one the dev server builds, and configurable tables are off, as a real Rancher keeps them
 * off an extension's tables but takes one built into the dev server for its own
 * @returns {Promise<{ entries: object[], close: () => void }>}
 */
export async function startRecordingProxy(target, port, { asExtension = false } = {}) {
  const entries = [];
  const targetPort = Number(target.port || 443);
  const origin = `${ target.protocol }//${ target.host }`;
  const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

  const forwardedHeaders = (headers) => {
    const out = { ...headers, host: target.host };

    if (out.origin) {
      out.origin = origin;
    }
    // Keep the bodies readable for the recording
    delete out['accept-encoding'];

    return out;
  };

  // Redirects are kept too: the replay can't redirect, so scrub-har.mjs answers them with their target
  const record = (req, startedDateTime, status, statusText, mimeType, text, location = '') => {
    if (KEPT_TYPES.includes(mimeType) || location) {
      entries.push({
        startedDateTime,
        request:  { method: req.method, url: `https://${ req.headers['x-api-host'] || '127.0.0.1:8005' }${ req.url }` },
        response: {
          status, statusText, redirectURL: location, content: { mimeType, text }
        }
      });
    }
  };

  const answer = (req, res, status, text) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(text);
    record(req, new Date().toISOString(), status, '', 'application/json', text);
  };

  const lockFeaturesOff = featuresOff(['ui-configurable-tables']);
  const rewrite = (req) => (asExtension && /^\/v1\/management\.cattle\.io\.features(\/|\?|$)/.test(req.url) ? lockFeaturesOff : undefined);

  const forward = (req, res, retried = false) => {
    const startedDateTime = new Date().toISOString();
    const change = req.method === 'GET' ? rewrite(req) : undefined;
    const upstream = https.request({
      hostname: target.hostname, port: targetPort, method: req.method, path: req.url, headers: forwardedHeaders(req.headers), agent
    }, (upRes) => {
      const mimeType = (upRes.headers['content-type'] || '').split(';')[0];
      const chunks = [];

      if (!change) {
        res.writeHead(upRes.statusCode, upRes.statusMessage, upRes.headers);
      }
      upRes.on('data', (chunk) => {
        chunks.push(chunk);
        if (!change) {
          res.write(chunk);
        }
      });
      upRes.on('end', () => {
        if (change) {
          const text = change(Buffer.concat(chunks).toString('utf8'));
          const headers = { ...upRes.headers, 'content-length': Buffer.byteLength(text) };

          delete headers['transfer-encoding'];
          res.writeHead(upRes.statusCode, upRes.statusMessage, headers);
          res.end(text);
          record(req, startedDateTime, upRes.statusCode, upRes.statusMessage || '', mimeType, text);

          return;
        }
        res.end();
        const location = upRes.statusCode >= 300 && upRes.statusCode < 400 ? upRes.headers.location : '';

        record(req, startedDateTime, upRes.statusCode, upRes.statusMessage || '', mimeType, Buffer.concat(chunks).toString('utf8'), location);
      });
    });

    // A kept-alive connection that was dropped on the way (VPNs and VM networks do that to idle ones)
    // never answers: give up on it, and try a read once more on a new connection
    upstream.setTimeout(30000, () => upstream.destroy(Object.assign(new Error('no answer in 30 s'), { code: 'ETIMEDOUT' })));
    upstream.on('error', (e) => {
      if (res.headersSent) {
        return res.destroy(e);
      }
      if (READS.includes(req.method) && !retried) {
        return forward(req, res, true);
      }
      console.error(`recording proxy: ${ req.method } ${ req.url } failed: ${ e.code || e.message }`);
      res.writeHead(502);
      res.end(e.message);
    });

    return req.pipe(upstream);
  };

  const server = http.createServer((req, res) => {
    if (asExtension && req.method === 'GET' && req.url.split('?')[0] === '/v1/uiplugins') {
      return answer(req, res, 200, JSON.stringify({ entries: {} }));
    }

    if (READS.includes(req.method) || WRITES_LET_THROUGH.test(req.url)) {
      return forward(req, res);
    }

    // Answer the write here, as if it had been saved
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      let text = '{}';

      try {
        text = JSON.stringify(JSON.parse(body));
      } catch {}
      answer(req, res, req.method === 'POST' ? 201 : 200, text);
    });
  });

  // Web sockets (live updates) go straight through, unrecorded
  server.on('upgrade', (req, socket, head) => {
    const upstream = tls.connect({
      host: target.hostname, port: targetPort, servername: net.isIP(target.hostname) ? undefined : target.hostname, rejectUnauthorized: false
    }, () => {
      const lines = [`${ req.method } ${ req.url } HTTP/1.1`, ...Object.entries(forwardedHeaders(req.headers)).map(([name, value]) => `${ name }: ${ value }`)];

      upstream.write(`${ lines.join('\r\n') }\r\n\r\n`);
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    const close = () => {
      socket.destroy();
      upstream.destroy();
    };

    upstream.on('error', close);
    socket.on('error', close);
  });

  await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).on('error', reject));

  return {
    entries,
    close: () => {
      server.close();
      agent.destroy();
    }
  };
}
