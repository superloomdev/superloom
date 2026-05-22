# Configuration

Configuration reference for `@superloomdev/js-server-helper-http-gateway-adapter-express`.

**Related docs:**
- [`api.md`](api.md) for the 3-method adapter contract
- [`middleware.md`](middleware.md) for required Express middleware setup
- [`../../js-server-helper-http-gateway/docs/configuration.md`](../../js-server-helper-http-gateway/docs/configuration.md) for the gateway loader and `CONFIG.ADAPTER` slot

---

## Loader Pattern

The adapter is a factory function. Pass it as `CONFIG.ADAPTER` to the gateway:

```javascript
const GatewayLoader  = require('@superloomdev/js-server-helper-http-gateway');
const ExpressAdapter = require('@superloomdev/js-server-helper-http-gateway-adapter-express');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: ExpressAdapter
});
```

Pass the factory function itself (the result of `require()`), not the result of calling it. The gateway invokes it once at construction time with `(Lib, ADAPTER_CONFIG, errors)` and reuses the returned adapter object for every request.

---

## Configuration Keys

The Express adapter accepts **no configuration**. All three loader parameters are unused:

| Loader parameter | Used by adapter? |
|---|---|
| `Lib` (the gateway's dependency container) | No |
| `ADAPTER_CONFIG` (the `CONFIG.ADAPTER_CONFIG` you pass to the gateway) | No |
| `errors` (the gateway's error catalog) | No |

If the gateway is configured with `ADAPTER_CONFIG`, this adapter ignores it. The parameters are accepted only to satisfy the adapter factory contract.

```javascript
// Both of these are equivalent for this adapter:
GatewayLoader(Lib, { ADAPTER: ExpressAdapter });
GatewayLoader(Lib, { ADAPTER: ExpressAdapter, ADAPTER_CONFIG: { anything: 'ignored' } });
```

---

## Runtime Dependencies

The adapter installs **zero npm packages**. It uses only Node.js built-ins and reads from objects the application provides.

The application is expected to install and wire:

| Package | Purpose | Required? |
|---|---|---|
| `express@>=5` | The HTTP server | Yes |
| `express.json()` middleware | Parses JSON bodies into `req.body` | Yes if you accept JSON |
| `express.urlencoded({ extended: true })` | Parses urlencoded bodies | Yes if you accept form data |
| `cookie-parser@>=1` | Populates `req.cookies` | Optional — adapter falls back to raw `Cookie` header |

See [`middleware.md`](middleware.md) for the full setup pattern.

---

## Country Code Customization

To enable country detection when fronting Express with a CDN (e.g. CloudFront), wrap the adapter and override `getHttpRequestCountryCode`:

```javascript
const ExpressAdapter = require('@superloomdev/js-server-helper-http-gateway-adapter-express');

function CustomAdapter (Lib, config, errors) {
  const base = ExpressAdapter(Lib, config, errors);
  return Object.assign({}, base, {
    getHttpRequestCountryCode: function (instance) {
      const headers = instance.http_request && instance.http_request.headers;
      return (headers && headers['cloudfront-viewer-country']) || null;
    }
  });
}

const Gateway = GatewayLoader(Lib, { ADAPTER: CustomAdapter });
```

The other two contract methods inherit from the base adapter unchanged.
