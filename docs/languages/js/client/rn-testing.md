# React Native Testing

> **Language:** JavaScript

How to test React Native and Expo modules in the Superloom framework. This page covers the testing philosophy, injection patterns for framework modules, component testing with `react-test-renderer`, integration testing with Metro, and CI placement.

## On This Page

- [Testing Philosophy](#testing-philosophy)
- [Module Testing Tiers for Framework Modules](#module-testing-tiers-for-framework-modules)
- [Test Loader Shape for Expo-Bound Modules](#test-loader-shape-for-expo-bound-modules)
- [Component Testing with react-test-renderer](#component-testing-with-react-test-renderer)
- [Integration Testing with Metro and Expo](#integration-testing-with-metro-and-expo)
- [CI Placement](#ci-placement)
- [End-to-End Tests](#end-to-end-tests)
- [Further Reading](#further-reading)

---

## Testing Philosophy

Helper modules test in pure Node with no Metro, no emulator, and no browser. The framework or engine is injected through `shared_libs` in the test loader, exactly as server modules inject adapters and cloud SDKs.

The reason is speed and isolation. A module that requires Metro to test cannot run in CI without the full Expo toolchain. A module that receives its platform dependencies through injection runs in milliseconds in pure Node, and the same test loader works in any CI environment.

App-level tests (screens, layouts, navigation) are the application project's responsibility, not the module's. Modules ship unit tests for their public API. Integration and E2E tests live in the consuming application's test suite.

---

## Module Testing Tiers for Framework Modules

Framework modules and client-side driver wrappers test in pure Node. The framework or engine enters through `shared_libs`, not through a direct import.

| Module tier | Injected as | Stub strategy |
|---|---|---|
| `js-react-helper-*` (Class I) | `shared_libs.React` | Real `react` and `react-test-renderer` from `node_modules`. No stub needed |
| `js-rnw-helper-*` (Class I) | `shared_libs.React`, capability slots | Real `react` and `react-test-renderer`. Platform APIs are stub objects with the surface the module calls |
| `js-client-helper-*-ext-react` (Class H) | `shared_libs.React`, `shared_libs.[Parent]` | Real `react` and `react-test-renderer`. Parent module loaded from registry or `file:../` |
| `js-client-helper-*-ext-web` (Class H) | `shared_libs.[Parent]`, DOM stubs | Parent from `file:../`. DOM APIs stubbed (`document`, `FontFace`) |
| `js-client-helper-*-ext-rn` (Class H) | `shared_libs.[Parent]`, native loader stub | Parent from `file:../`. Native loader is a stub with the engine's interface |
| `js-client-helper-*-ext-expo` (Class H) | `shared_libs.[Parent]`, Expo API stub | Parent from `file:../`. Expo API is a stub with the surface the module calls |
| `js-rn-helper-*` (Class C) | `shared_libs.[Engine]` | Engine stub in `_test/` implementing the native interface |
| `js-rnw-helper-*` (Class C) | `shared_libs.[Engine]` | Engine stub in `_test/` implementing the Expo SDK interface |

---

## Test Loader Shape for Expo-Bound Modules

The test loader builds the `shared_libs` container with the framework entry and capability stubs, then calls the module loader.

### Class I: Standalone React Module

```javascript
// _test/loader.js

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import helperUtils from 'helper-utils';
import helperDebug from 'helper-debug';
import helperIdle from 'helper-idle';

const Utils = helperUtils();
const Debug = helperDebug();

const Idle = helperIdle({
  React,
  Utils,
  Debug
});

export default { React, ReactTestRenderer, Idle, Utils, Debug };
```

Real `react` and `react-test-renderer` run in Node. No Metro, no browser. The module's hooks render inside a test component and the test asserts on the rendered output.

### Class H: Expo Extension with Capability Stub

```javascript
// _test/loader.js

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import helperUtils from 'helper-utils';
import helperDebug from 'helper-debug';
import helperFont from 'helper-font';
import helperFontExtExpo from 'helper-font-ext-expo';

const Utils = helperUtils();
const Debug = helperDebug();

// Stub the Expo font API surface
const FontLoader = {
  loadAsync: async function () { return; },
  isLoaded: () => true
};

// Load the pure parent from file reference
const Font = helperFont({
  Utils,
  Debug
});

// Load the Expo extension, injecting the parent and the capability stub
const ExpoExtension = helperFontExtExpo({
  React,
  Utils,
  Debug,
  Font,
  FontLoader
});

export default { React, ReactTestRenderer, Font, ExpoExtension, Utils, Debug };
```

The slot is named for the capability (`FontLoader`), not the vendor (`ExpoFont`). The same module runs against an Expo-backed loader, a bare RN loader, or this stub with no source edit. See [Expo Guide](expo-guide.md) for the capability injection pattern.

### Class C: Engine Stub for Native Module Wrapper

```javascript
// _test/loader.js

import helperUtils from 'helper-utils';
import helperDebug from 'helper-debug';
import helperKvMmkv from 'helper-kv-mmkv';

const Utils = helperUtils();
const Debug = helperDebug();

// Engine stub implementing the native module's interface
const MMKVStub = {
  getString: function (key) { return this._store[key] || null; },
  set: function (key, value) { this._store[key] = value; },
  delete: function (key) { delete this._store[key]; },
  _store: {}
};

const KV = helperKvMmkv({
  Utils,
  Debug,
  MMKV: MMKVStub
});

export default { KV, Utils, Debug, MMKVStub };
```

The engine stub lives in `_test/` and implements the native module's JavaScript interface. It never imports the real native module. See [Unit Test Authoring](../unit-test-authoring.md) for the engine stub pattern.

---

## Component Testing with react-test-renderer

A Class I module that ships hooks (for example, a `useIdle` or `useTimer` hook) tests the hook's logic by calling it inside a test component rendered with `react-test-renderer`. The test asserts on the rendered output or on side effects.

```javascript
// _test/test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import lib from './loader.js';
const { Idle } = lib;

describe('useIdle hook', function () {

  it('should render active state initially', function () {

    function TestComponent () {

      const { isActive } = Idle.useIdle({ timeout_ms: 5000 });
      return React.createElement('Text', null, isActive ? 'active' : 'idle');

    }

    const renderer = ReactTestRenderer.create(
      React.createElement(TestComponent)
    );

    const json = renderer.toJSON();
    assert.strictEqual(json.children[0], 'active');

  });

});
```

No DOM, no browser, no Metro. `react-test-renderer` produces a JSON tree that the test inspects. This is the same pattern used by React extension modules that ship `useTheme` or `useStyles` hooks.

### Testing State Transitions

For hooks that respond to time or events, the test advances mock time or triggers events and re-renders:

```javascript
it('should transition to idle after timeout', function () {

  const clock = { now: 0 };
  const events = [];

  function TestComponent () {

    const { isActive } = Idle.useIdle({
      timeout_ms: 5000,
      clock: clock,
      eventSources: events
    });

    return React.createElement('Text', null, isActive ? 'active' : 'idle');

  }

  const renderer = ReactTestRenderer.create(
    React.createElement(TestComponent)
  );

  // Advance mock time past the timeout
  clock.now = 6000;
  renderer.update(React.createElement(TestComponent));

  const json = renderer.toJSON();
  assert.strictEqual(json.children[0], 'idle');

});
```

The hook receives `clock` and `eventSources` through injection, so the test controls time and events without real timers or platform APIs.

---

## Integration Testing with Metro and Expo

Integration testing with Metro and Expo is an application-level concern, not a module-level concern. Modules do not ship integration tests that require Metro.

### When Integration Testing Is Needed

| Scenario | Where it lives | What it tests |
|---|---|---|
| Module loads in Metro without bundler errors | Application project | Import resolution, platform-file selection |
| Font loading renders correctly on native | Application project | Expo font registration, theme token resolution |
| Component library renders on web | Application project | React Native Web DOM mapping |
| Navigation works across platforms | Application project | Expo Router deep links, typed routes |

### React Native Web Alias Tier

Aliasing `react-native` to `react-native-web` in a test package lets shared components render under `node --test` with no Expo in the module graph. The alias maps the `react-native` import to `react-native-web` at resolution time, so components that call `View`, `Text`, and `StyleSheet` render through React DOM without Metro, without a browser, and without any `expo-*` package installed.

This makes the alias tier a portability check, not only a unit-test convenience. If a shared component imports `expo-router` or any other `expo*` package, the test fails with `MODULE_NOT_FOUND` because the test package has no Expo dependency. The failure is the signal: shared source has acquired an app-framework coupling that the portability fence forbids.

### Manual Verification

For manual verification during development:

```bash
npx expo start              # Start Metro
# Scan QR for Expo Go, or press i for iOS, a for Android, w for web
```

This verifies that the module loads and renders in the full Expo runtime. It is not automated and does not run in module CI.

---

## CI Placement

Framework modules are offline modules. They need no Docker, no AWS credentials, and no dedicated CI job.

| Module type | CI placement | Docker | AWS credentials |
|---|---|---|---|
| `js-react-helper-*` (Class I) | `test-offline` matrix | No | No |
| `js-rnw-helper-*` (Class I) | `test-offline` matrix | No | No |
| `js-client-helper-*-ext-*` (Class H) | `test-offline` matrix | No | No |
| `js-rn-helper-*` (Class C) | `test-offline` matrix | No | No |

Add the module path to the `test-offline` matrix in the CI workflow. The publish job auto-detects it from the `detect` job output. See [Module Testing](../module-testing.md) for the full CI placement guide.

---

## End-to-End Tests

End-to-end (E2E) tests verify the full application flow on a device or simulator. They use tools like Detox or Maestro and run against a built app binary.

E2E tests are an application concern. Modules do not ship E2E tests. The contract a module must satisfy is testable in pure Node through injection. The application project's E2E suite verifies that modules work together in the full runtime.

| E2E tool | Scope | Where it lives |
|---|---|---|
| Detox | Native app E2E on iOS and Android simulators | Application project |
| Maestro | Flow-based UI testing on simulators and devices | Application project |
| Playwright | Web E2E in a real browser | Application project |

---

## Further Reading

- [Module Testing](../module-testing.md) - Testing tiers, badges, CI placement, framework module testing
- [Testing Strategy](../testing-strategy.md) - Test layout, simulating loader, three-tier pattern
- [Unit Test Authoring](../unit-test-authoring.md) - How to write a single unit test, engine stub pattern
- [Expo Guide](expo-guide.md) - Capability injection pattern, Expo SDK capabilities
- [Client Architecture](client-architecture.md) - The Expo and Metro pipeline
- [React Native Environment Setup](rn-environment-setup.md) - System prerequisites for local development
