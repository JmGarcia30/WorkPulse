/* eslint-disable @typescript-eslint/no-require-imports -- Local HTTP test transport preserving the Host header on Node 24. */
const { request } = require('node:http');
module.exports = async function localFetch(input, options = {}) {
  const url = new URL(input);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw Error('NON_LOCAL_TEST_HTTP_TARGET');
  // Request serializes multipart forms; http.request transmits the actual tenant
  // Host. Node 24 fetch replaces Host with the connection URL's authority.
  const encoded = new Request(url, options);
  const bytes = encoded.body ? Buffer.from(await encoded.arrayBuffer()) : undefined;
  return new Promise((resolve, reject) => {
    const req = request(url, { method: encoded.method, headers: Object.fromEntries(encoded.headers) }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const headers = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response([204, 205, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(Error('LOCAL_TEST_HTTP_TIMEOUT')));
    req.end(bytes);
  });
};
