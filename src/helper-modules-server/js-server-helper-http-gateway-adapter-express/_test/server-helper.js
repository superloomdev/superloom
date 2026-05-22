// Info: Real-HTTP test infrastructure for js-server-helper-http-gateway-adapter-express.
// Spins up an actual Express server on a random free port, returns helpers to
// make real fetch requests against it, and provides clean shutdown. The point
// of this module is to exercise the adapter against the real Express runtime
// (real req/res/middleware) instead of stubbed objects - that is the only way
// to verify wire-level compatibility with Express version upgrades.
'use strict';


const express      = require('express');
const cookieParser = require('cookie-parser');


/********************************************************************
Start a real Express server on a random free port and bind the
caller-supplied setup function to it. The setup function receives the
Express app and registers routes that the test will invoke via fetch.

Standard middleware is always installed: express.json, express.urlencoded,
and cookie-parser. Tests that need to verify the adapter's raw-Cookie-header
fallback should not rely on cookie-parser being available - in that case use
startBareTestServer instead.

@param {Function} setupFn - (app) => void; registers routes on the app

@return {Promise<Object>} - { server, port, baseUrl, close }
*********************************************************************/
function startTestServer (setupFn) {

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  setupFn(app);

  return listenOnRandomPort(app);

}


/********************************************************************
Same as startTestServer but without cookie-parser - lets tests verify
the adapter's raw-Cookie-header parsing fallback path.

@param {Function} setupFn - (app) => void

@return {Promise<Object>} - { server, port, baseUrl, close }
*********************************************************************/
function startBareTestServer (setupFn) {

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  setupFn(app);

  return listenOnRandomPort(app);

}


/********************************************************************
Make a real HTTP request against the test server. Wraps fetch with a
slightly more convenient response shape that includes parsed body,
all headers as a plain object, and a parsed Set-Cookie array.

@param {String} baseUrl - e.g. 'http://127.0.0.1:54321'
@param {String} path    - URL path, e.g. '/users/42?q=1'
@param {Object} [opts]  - { method, headers, body, cookies }
  method  {String}        - 'GET' | 'POST' | ... (default 'GET')
  headers {Object}        - Extra request headers
  body    {String|Object} - Request body. Objects are JSON.stringified.
  cookies {Object}        - { name: value } pairs sent as Cookie header

@return {Promise<Object>} - { status, headers, body, setCookies, raw }
*********************************************************************/
async function makeRequest (baseUrl, path, opts) {

  const options = opts || {};
  const method = options.method || 'GET';
  const headers = Object.assign({}, options.headers || {});

  let body = options.body;

  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof Uint8Array)) {

    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    body = JSON.stringify(body);

  }

  if (options.cookies && typeof options.cookies === 'object') {

    const cookie_pairs = [];
    const cookie_keys = Object.keys(options.cookies);

    for (let i = 0; i < cookie_keys.length; i++) {
      const key = cookie_keys[i];
      cookie_pairs.push(key + '=' + encodeURIComponent(options.cookies[key]));
    }

    headers['Cookie'] = cookie_pairs.join('; ');

  }

  const fetch_opts = {
    method : method,
    headers: headers,
    redirect: 'manual'
  };

  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    fetch_opts.body = body;
  }

  const res = await fetch(baseUrl + path, fetch_opts);

  const response_headers = {};

  res.headers.forEach(function (value, key) {
    response_headers[key] = value;
  });

  // res.headers.getSetCookie() returns each Set-Cookie header individually
  const set_cookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [];

  const response_body_text = await res.text();

  let parsed_body = response_body_text;

  const content_type = response_headers['content-type'] || '';

  if (content_type.includes('application/json') && response_body_text.length > 0) {
    try {
      parsed_body = JSON.parse(response_body_text);
    }
    catch {
      parsed_body = response_body_text;
    }
  }

  return {
    status    : res.status,
    headers   : response_headers,
    body      : parsed_body,
    setCookies: set_cookies,
    raw       : response_body_text
  };

}


/*****************************************************************************
INTERNAL HELPERS
*****************************************************************************/

/********************************************************************
Bind the given Express app to port 0 (random free port) and return
the server handle plus a close() helper that resolves only when the
underlying socket is fully released.

@param {Object} app - Express application

@return {Promise<Object>} - { server, port, baseUrl, close }
*********************************************************************/
function listenOnRandomPort (app) {

  return new Promise(function (resolve, reject) {

    const server = app.listen(0, '127.0.0.1', function () {

      const port = server.address().port;
      const base_url = 'http://127.0.0.1:' + port;

      resolve({
        server : server,
        port   : port,
        baseUrl: base_url,
        close  : function () {
          return new Promise(function (close_resolve) {
            server.close(function () {
              close_resolve();
            });
          });
        }
      });

    });

    server.on('error', reject);

  });

}


module.exports = {
  startTestServer    : startTestServer,
  startBareTestServer: startBareTestServer,
  makeRequest        : makeRequest
};
