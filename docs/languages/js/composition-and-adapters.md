# Composition and Adapters

> **Language:** JavaScript

This file is the JavaScript implementation of the [Composition and Adapters](../../principles/composition-and-adapters.md) principles chapter. It gives the concrete syntax, real module names, and worked examples a JavaScript developer needs to use the pattern.

## On This Page

- [The Standard Adapter Signature](#the-standard-adapter-signature)
- [The Four Tiers in Published Modules](#the-four-tiers-in-published-modules)
- [Peer Dependency Rules per Tier](#peer-dependency-rules-per-tier)
- [The Application Composition Root](#the-application-composition-root)
- [The Adapter Gate](#the-adapter-gate)
- [Host Adapters](#host-adapters)
- [Adding a Host](#adding-a-host)
- [Adding a Slot](#adding-a-slot)
- [The Test Tier Is a Host](#the-test-tier-is-a-host)
- [Naming](#naming)
- [Anti-Patterns](#anti-patterns)
- [Further Reading](#further-reading)

---

## The Standard Adapter Signature

Every adapter in every tier is a factory function with the same shape:

```js
export default function (shared_libs, config) {
  return { /* ready-to-use object */ };
};
```

Two rules make this work:

1. **The adapter returns its value.** It never assigns onto the container. The caller receives the return value and decides where to put it.
2. **The caller assigns the container key.** The composition root names the slot. When the caller owns the key name, an adapter cannot introduce a vendor-named slot.

The reason for the second rule: if the adapter assigned `Lib.ExpoFont`, every adapter for the Fonts port would be forced to use the vendor name. When the caller assigns `Lib.Fonts`, the vendor name stays inside the adapter and the container stays clean.

---

## The Four Tiers in Published Modules

### Store

A feature module defines a storage contract. Each store adapter implements it for one backend.

The auth feature module defines an eight-method session store contract. The Postgres store adapter implements it:

```js
import authStorePostgres from 'helper-auth-store-postgres';
import auth from 'helper-auth';

Lib.SQL = Lib.Postgres;

const Store = authStorePostgres(Lib, {
  table_name: 'sessions_user'
});

Lib.AuthUser = auth(Lib, {
  Store: Store,
  ACTOR_TYPE: 'user'
});
```

The parent receives the store through its config. The parent never imports the store. The store never imports the parent. The composition root wires them.

### Transport Adapter

A feature module defines a runtime contract. Each transport adapter implements it for one server runtime.

The HTTP gateway defines a request/response contract. The Express adapter implements it:

```js
import httpGatewayAdapterExpress from 'helper-http-gateway-adapter-express';
import httpGateway from 'helper-http-gateway';

const Adapter = httpGatewayAdapterExpress(Lib, {});

const Gateway = httpGateway(Lib, {
  Adapter: Adapter
});
```

The pattern is identical to the store tier. The difference is what the port governs: data persistence versus runtime transport.

### Extension

A pure parent module defines a framework-binding contract. Each extension implements it for one framework and imports the parent.

The font module defines a font-loading contract. The Expo extension implements it:

```js
import FontExtExpo from 'helper-font-ext-expo';

const adapter = FontExtExpo(Lib, {});
```

The extension declares the parent as a peer dependency. This is the only tier where the adapter imports the parent. The extension consumes the parent's API, so it needs the parent at load time.

### Host Adapter

An application's shared source defines ports for platform capabilities. Each build target supplies its own adapter set.

The demo application defines three ports: Navigation, Icons, and Fonts. The Expo build target supplies one set; the web build target supplies another. These are not published packages. They are files inside the application's source tree.

---

## Peer Dependency Rules per Tier

The table below is populated from the verified `package.json` files of each reference module, not from memory.

| Tier | Adapter declares parent as peer? | Reason |
|---|---|---|
| Driver | No | The driver has no parent; it wraps one external service |
| Store | No | The store is passed to the parent at load time; the parent never imports the store |
| Transport adapter | No | Same as store: the adapter is passed to the parent |
| Extension | Yes | The extension imports and consumes the parent at load time |
| Host adapter | N/A | Not a published package; no `package.json` |

Cross-reference: [dependencies.md](dependencies.md) for the full peer dependency rules.

---

## The Application Composition Root

The application loader is the composition root. It runs in ordered phases:

1. **Validate the adapter set.** The gate runs before anything is built. A missing slot throws.
2. **Merge configuration.** Static config is loaded and merged with runtime overrides.
3. **Build host-independent modules.** Foundation helpers (Utils, Debug) that do not depend on any adapter.
4. **Build adapters.** Each host adapter is called with `Lib` and returns its value. The loader assigns the return value to the container slot.
5. **Build adapter-dependent modules.** Fonts, themes, and the theme context, which depend on the adapter-supplied slots.
6. **Return.** The loader returns `{ Lib, Config }` to the React tree.

The phase boundaries carry banner comments so the ordering is explicit rather than implied by line position. A developer reading the loader sees where each phase starts and ends.

The loader is a pure build function. It is not memoized. The React context provider holds the only cache, memoizing on the adapter set reference. This lets a test build a second independent container by calling the loader with a different adapter set.

---

## The Adapter Gate

The `loader.validators.js` file exports a `validateAdapters` function. It runs before the container is built, so it uses raw `typeof` instead of the Utils type primitives:

```js
const REQUIRED_ADAPTERS = ['Navigation', 'Icons', 'Fonts'];

validateAdapters: function (adapters) {
  if (adapters === null || typeof adapters !== 'object') {
    throw new TypeError('loader: adapters must be an object supplying ' + REQUIRED_ADAPTERS.join(', '));
  }
  const missing = [];
  for (let i = 0; i < REQUIRED_ADAPTERS.length; i++) {
    const slot = REQUIRED_ADAPTERS[i];
    if (typeof adapters[slot] !== 'function') {
      missing.push(slot);
    }
  }
  if (missing.length > 0) {
    throw new TypeError('loader: missing or invalid adapter slots: ' + missing.join(', '));
  }
}
```

The raw `typeof` is an explicit exception to the Utils-primitives rule in [validation.md](validation.md). The exception is necessary because the gate runs before `Lib.Utils` exists, so the type-check primitives are not yet available. The exception is documented here so it does not read as a violation.

The gate throws a single `TypeError` naming every missing slot in one message. A host missing two adapters gets one error listing both, not two errors on successive boots.

---

## Host Adapters

A multi-target application defines one port per platform capability. The slot table:

| Slot | Port defines | Adapter returns | Expo host | Web host |
|---|---|---|---|---|
| `Navigation` | `Link`, `Redirect` | `{ Link, Redirect }` | `expo-router` primitives | Browser history API |
| `Icons` | `Glyph` | `{ Glyph }` | `@expo/vector-icons` | Text placeholder |
| `Fonts` | `adapter`, `manifest` | `{ adapter, manifest }` | `expo-font` extension | No-op stub |

Each host has its own directory under `hosts/`:

```text
hosts/
  expo/
    adapters/
      navigation.js
      icons.js
      fonts.js
  web/
    adapters/
      navigation.js
      icons.js
      fonts.js
```

The same port implemented twice. The Expo navigation adapter wraps `expo-router`:

```js
import { Link, Redirect } from 'expo-router';

export default function (Lib, config) {
  return {
    Link: Link,
    Redirect: Redirect
  };
};
```

The web navigation adapter implements the same two members against browser primitives:

```js
function Link (props) {
  function navigate (e) {
    e.preventDefault();
    window.history.pushState({}, '', props.href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  return React.createElement('a', { href: props.href, onClick: navigate }, props.children);
}

function Redirect (props) {
  React.useEffect(function () {
    window.location.replace(props.href);
  }, [props.href]);
  return null;
}

export default function (Lib, config) {
  return {
    Link: Link,
    Redirect: Redirect
  };
};
```

Both return `{ Link, Redirect }`. The loader assigns the return value to `Lib.Navigation`. The rest of the application calls `Lib.Navigation.Link` and never knows which host is running.

---

## Adding a Host

1. **Create the adapter directory.** Add `hosts/[name]/adapters/` with one file per slot.
2. **Implement every slot.** Each file exports a factory matching the standard adapter signature.
3. **Declare the adapter set at module scope.** In the host's entry file, import each adapter and pass them to the provider as a stable reference.
4. **Pass the set to the provider.** The provider calls the real loader with the adapter set.
5. **Run the build.** A missing slot fails at boot with a named error, which is the whole point of the gate.

The adapter set must be a module-scope reference, not an inline object literal. An inline literal creates a new object on every render, which defeats the provider's memoization and rebuilds the container on every render.

---

## Adding a Slot

1. **Add the slot name to `REQUIRED_ADAPTERS`** in `loader.validators.js`.
2. **Implement the adapter** in every host directory, including the test host.
3. **Wire the return value** in the loader's adapter injection phase.
4. **Document the port contract** in the application's adapter documentation.

Adding a slot is a breaking change for every host. The gate enforces this: a host that has not implemented the new slot throws at boot. There is no graceful degradation. The breaking change is visible immediately, which is safer than a silent missing capability.

---

## The Test Tier Is a Host

A test suite exercising an application supplies its own adapter set and calls the real composition root. The test fixture:

```js
import navigationAdapter from './adapters/navigation.js';
import iconsAdapter from './adapters/icons.js';
import fontsAdapter from './adapters/fonts.js';
import loader from '../app-core/loader.js';

const { Lib } = loader({
  Navigation: navigationAdapter,
  Icons: iconsAdapter,
  Fonts: fontsAdapter
});
```

The stub adapters are minimal. The navigation stub returns an `<a>` element. The icons stub returns a text placeholder. The fonts stub resolves immediately with an empty manifest.

Three prohibitions:

1. **No hand-built container.** The test calls the real loader. It never assembles `Lib` by hand.
2. **No direct helper-module import in the fixture.** The loader wires helper modules. The fixture wires only stub adapters.
3. **No inlined platform constant.** The platform value comes from the assembled theme, not from a hardcoded string in the fixture.

Cross-reference: [module-testing.md](module-testing.md) covers module test loaders. This section covers application composition. The two are complementary: module testing injects dependencies into a single module; application testing supplies adapters to the composition root.

---

## Naming

The capability-not-vendor rule binds application slots identically to module slots. See [module-structure.md](module-structure.md) for the module-slot rule.

The violation: an adapter that assigns `Lib.Ionicons`:

```js
export default function (Lib, config) {
  Lib.Ionicons = Ionicons;
  return {};
};
```

The fix: the adapter returns a capability-named member, and the loader assigns the slot:

```js
export default function (Lib, config) {
  return {
    Glyph: Ionicons
  };
};
```

The loader assigns: `Lib.Icons = adapters.Icons(Lib, {});`. The vendor name `Ionicons` appears in the adapter file and nowhere else. The container slot is `Lib.Icons`, named for the capability.

---

## Anti-Patterns

**The optional guard.** An adapter that might not be present:

```js
if (shared_libs && shared_libs.Fonts) {
  // use Fonts
}
```

The guard converts a boot-time failure into a runtime failure. Make the slot mandatory and fail at boot.

**The adapter that assigns onto the container.** An adapter that mutates `Lib` directly:

```js
export default function (Lib, config) {
  Lib.Navigation = { Link: Link, Redirect: Redirect };
};
```

The adapter should return its value. The caller assigns the key. When the adapter assigns, it owns the key name, and a vendor-named slot can slip in.

**The memoized composition root.** A loader that caches its return value:

```js
let cached;
export default function loader (adapters) {
  if (cached) return cached;
  cached = build(adapters);
  return cached;
};
```

A memoized loader prevents a test from building a second independent container. The cache belongs in the React provider, not in the loader.

**The duplicated test fixture.** A test that builds `Lib` by hand instead of calling the real loader:

```js
import helperUtils from 'helper-utils';
import helperDebug from 'helper-debug';

const Lib = {
  Utils: helperUtils({}),
  Debug: helperDebug({}),
  // ... hand-wired
};
```

The hand-built fixture drifts from the real loader. Use the real loader with stub adapters.

---

## Further Reading

- [Composition and Adapters (principles)](../../principles/composition-and-adapters.md) - the language-agnostic doctrine
- [Module Classes](module-classes.md) - the nine-class taxonomy, including Class I
- [Module Structure](module-structure.md) - loader patterns and the fixed interface slots
- [Dependencies](dependencies.md) - peer dependency rules and the Lib container
- [Client Loader](client/client-loader.md) - the application loader, container table, and boot chain
- [Module Testing](module-testing.md) - module test loaders (companion to the application composition section here)
