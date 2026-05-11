# Express API Adapter

Express.js entry point for Docker/self-hosted deployment. Converts Express requests into the standardized request format and delegates to shared controllers.

## Files

| File | Purpose |
|---|---|
| `server.js` | Startup script - runs loader, initializes app, starts listening |
| `app.js` | Express application factory - middleware, routes, error handlers |
| `routes/user.js` | User entity routes - converts Express req to standard format |

## How It Works

1. `server.js` runs the loader to build `Lib` and `Config`
2. `app.js` creates the Express application with middleware and routes
3. Each route file converts `req` to standardized request via `Functions.buildStandardRequest`
4. Standardized request is passed to the shared controller (same as Lambda)
5. Controller response is sent back via `res.status().json()`

## Adding New Routes

1. Create `routes/[entity].js` following the same pattern as `routes/user.js`
2. Register in `app.js`: `app.use('/entity', require('./routes/entity')(Lib))`

## Running

```bash
# Development
node src/server/interfaces/api/express/server.js

# With environment variables
PORT=8080 DB_HOST=localhost node src/server/interfaces/api/express/server.js
```

## Dependencies
- `express` - HTTP framework
- `src/server/common/loader.js` - Dependency initialization
- `src/server/common/functions.js` - Request/response standardization
- All controllers loaded via `Lib`
