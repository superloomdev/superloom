# Expo Guide

> **Language:** JavaScript

Expo is the app framework for the Superloom client stack. This page documents what Expo provides, when to build a Superloom adapter versus using Expo directly, the capability injection pattern, prebuild and CNG, SDK versioning, and the cloud account features that require an Expo account.

## On This Page

- [What Expo Provides](#what-expo-provides)
- [Adapter Versus Direct Use](#adapter-versus-direct-use)
  - [When to Wrap](#when-to-wrap)
  - [When a Pure Parent Exists](#when-a-pure-parent-exists)
  - [When No Second Consumer Exists](#when-no-second-consumer-exists)
- [Capability Injection Pattern](#capability-injection-pattern)
- [Prebuild and Continuous Native Generation](#prebuild-and-continuous-native-generation)
  - [How CNG Works](#how-cng-works)
  - [When to Use Prebuild](#when-to-use-prebuild)
  - [Dev Client Versus Expo Go](#dev-client-versus-expo-go)
- [Expo SDK Versioning](#expo-sdk-versioning)
  - [Upgrading the SDK](#upgrading-the-sdk)
  - [Version Pinning](#version-pinning)
  - [Breaking Changes](#breaking-changes)
- [Expo Cloud Account Features](#expo-cloud-account-features)
  - [EAS Build](#eas-build)
  - [EAS Update](#eas-update)
  - [EAS Submit](#eas-submit)
  - [Free Tier Limitations](#free-tier-limitations)
  - [When a Paid Plan Is Needed](#when-a-paid-plan-is-needed)
  - [What Works Without an Account](#what-works-without-an-account)
- [Further Reading](#further-reading)

---
## What Expo Provides

The Expo SDK bundles capabilities that would otherwise require separate native modules, manual linking, and platform-specific configuration. Each capability ships as a versioned package under the `expo-*` namespace.

| Capability | Expo package | What it handles |
|---|---|---|
| Fonts | `expo-font` | Font registration on native, `@font-face` injection on web |
| Assets | `expo-asset` | Asset loading, caching, local URI resolution |
| File system | `expo-file-system` | Read, write, and manage files on device |
| Secure storage | `expo-secure-store` | Encrypted key-value storage on native |
| SQLite | `expo-sqlite` | Local relational database |
| Notifications | `expo-notifications` | Push notification registration and handling |
| Image picker | `expo-image-picker` | Camera and photo library access |
| Camera | `expo-camera` | Camera preview and capture |
| Location | `expo-location` | Geolocation and permissions |
| Application info | `expo-application` | Version, build number, installation metadata |
| Device info | `expo-device` | Platform, model, OS version |
| Screen orientation | `expo-screen-orientation` | Lock and detect orientation changes |
| Splash screen | `expo-splash-screen` | Native splash screen control |

These packages work in any React Native project via `npx install-expo-modules`. The distinction between Expo Go and prebuild concerns the dev workflow, not package consumption. A project that uses `expo-font` without Expo Go or prebuild still benefits from the package.

---

## Adapter Versus Direct Use

The rule: if a capability is consumed inside a helper module, wrap it behind a capability-named injection slot. If a capability is consumed only in app code (screens, layouts, boot files), use the Expo API directly.

The reason is decoupling. A helper module that imports `expo-font` directly is bound to Expo in its source text. A helper module that receives a `FontLoader` capability through `shared_libs` works against any backend that satisfies the contract. The same module runs against Expo, a bare RN loader, or a test stub with no edit.

### When to Wrap

| Condition | Action |
|---|---|
| The capability is needed inside a helper module | Wrap behind a capability-named injection slot |
| The capability is needed inside a Class H extension | The extension imports the Expo package directly; the parent stays pure |
| The capability is needed only in app code | Use the Expo API directly in the app |

### When a Pure Parent Exists

When a module's logic has a second consumer beyond Expo, the architecture splits into a pure parent (Class G) and an Expo extension (Class H). The parent holds the framework-free logic. The extension imports the Expo package and implements the adapter contract.

The extension is named `[parent]-ext-expo`. It imports the pure parent and adds Expo-specific code. The parent never imports Expo.

### When No Second Consumer Exists

When Expo is the only consumer, a standalone module takes the `js-rnw-helper-*` prefix (Class I). The module imports the Expo package directly and exposes its API through the loader pattern. The [decision test](client-modules.md#pure-core-with-extensions-or-a-single-framework-module) determines the shape before creation.

---

## Capability Injection Pattern

Injection slots in `shared_libs` are named for the capability, never for the vendor that satisfies it.

| Correct | Incorrect | Reason |
|---|---|---|
| `shared_libs.FontLoader` | `shared_libs.ExpoFont` | The slot describes what it does, not what provides it |
| `shared_libs.KeyValueStore` | `shared_libs.MMKV` | A vendor-named slot couples the module to that vendor through its own source text |
| `shared_libs.AssetLoader` | `shared_libs.ExpoAsset` | The same module can swap backends without a source edit |

The rule binds module code, test loaders, host manifests, and documentation examples equally. A test loader injects a stub with the same surface:

```javascript
const FontLoader = {
  useFonts: () => [true, null]
};
```

The module calls `shared_libs.FontLoader.useFonts()` without knowing whether the backend is Expo, a bare RN loader, or a test stub. This is what makes the module testable in pure Node with no Metro and no emulator.

See [Client Loader](client-loader.md) for how injection slots enter the `Lib` container, and [Module Structure](../module-structure.md) for the Class I and Class H loader patterns.

---

## Prebuild and Continuous Native Generation

Prebuild generates native project directories (`ios/` and `android/`) from the Expo app configuration (`app.json` or `app.config.js`). This is called Continuous Native Generation (CNG).

### How CNG Works

1. The app configuration in `app.json` declares native dependencies and plugins
2. `npx expo prebuild` reads the configuration and generates `ios/` and `android/` directories
3. The generated directories are gitignored and regenerated on demand
4. Native builds (Xcode, Gradle) run against the generated directories
5. `npx expo prebuild --clean` regenerates from scratch, discarding manual native edits

### When to Use Prebuild

| Scenario | Prebuild needed |
|---|---|
| Expo Go development | No |
| Dev client with custom native modules | Yes |
| EAS Build for app store binaries | Yes (EAS handles it automatically) |
| Local `npx expo run:ios` or `run:android` | Yes |

### Dev Client Versus Expo Go

Expo Go cannot run custom native modules. When a project includes native code beyond the Expo SDK, a dev client replaces Expo Go. The dev client is a custom build of the Expo runtime that includes the project's native dependencies.

```bash
npx expo prebuild
npx expo run:ios     # Builds dev client and runs on iOS
```

The dev client preserves Expo's developer tools (hot reload, dev menu, error overlay) while supporting custom native code.

---

## Expo SDK Versioning

The Expo SDK aligns with React Native releases. Each SDK version pins a specific React Native version and a set of compatible `expo-*` package versions.

### Upgrading the SDK

```bash
npx expo install expo@latest
npx expo install --fix
```

The first command upgrades the `expo` package. The second command upgrades all `expo-*` packages to versions compatible with the new SDK. This two-step process prevents version mismatches between the SDK and its packages.

### Version Pinning

Pin the Expo SDK version in `package.json`. Do not use caret ranges for the `expo` package itself. The `expo-*` packages use caret ranges within a major SDK version.

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-font": "~13.0.0"
  }
}
```

### Breaking Changes

Expo SDK upgrades can introduce breaking changes. The SDK changelog on Expo's documentation site lists the changes per version. Review the changelog before upgrading.

---

## Expo Cloud Account Features

Local development requires no Expo account. The features in this section require a free or paid Expo account and depend on Expo's cloud infrastructure.

### EAS Build

EAS Build compiles app binaries for iOS and Android in Expo's cloud. The service runs the native build (Xcode, Gradle) on Expo's servers and returns a signed binary.

| Feature | Account requirement |
|---|---|
| iOS builds | Free account (limited builds per month) |
| Android builds | Free account (more builds than iOS) |
| Priority builds | Paid plan |
| Custom build profiles | Free account |

iOS builds on the free tier are limited per month. Android builds have a higher allowance. Paid plans increase build volume and add priority queues.

### EAS Update

EAS Update pushes JavaScript bundle updates to deployed apps without a new app store release. This is the OTA (over-the-air) update mechanism.

| Feature | Account requirement |
|---|---|
| Update publishing | Free account |
| Update branching and channels | Free account |
| Production-scale concurrency | Paid plan |
| Update rollback | Free account |

Updates published through EAS Update are signed and versioned. The client runtime checks for updates on app launch and applies them on the next restart.

### EAS Submit

EAS Submit sends built binaries to Apple App Store Connect and Google Play Console. It automates the upload and metadata submission process.

| Feature | Account requirement |
|---|---|
| App Store submission | Free account |
| Play Store submission | Free account |
| Auto-submission on build | Free account |

EAS Submit requires the respective store credentials to be configured in the Expo account.

### Free Tier Limitations

The free tier covers individual development and small-scale projects. The limitations to be aware of:

| Limitation | Free tier |
|---|---|
| iOS cloud builds | Limited per month |
| Android cloud builds | Higher allowance than iOS |
| Update concurrency | Limited concurrent viewers |
| Team seats | One developer |
| Build priority | Standard queue |

Verify current limits on Expo's pricing page, as the free tier allowances change over time.

### When a Paid Plan Is Needed

A paid plan is needed when:

- Multiple developers need team access to EAS
- Production-scale OTA updates require higher concurrency
- Build volume exceeds the free tier monthly allowance
- Priority build queues are needed for faster CI feedback

### What Works Without an Account

All local development works with zero account. The complete command table, including `--offline`, `--go`, `--localhost`, and `--tunnel` flags, is documented in [React Native Environment Setup](rn-environment-setup.md#running-on-a-physical-device).

---

## Further Reading

- [Client Architecture](client-architecture.md) - Stack decision record, project layout
- [React Native Environment Setup](rn-environment-setup.md) - System prerequisites and local development
- [React Native Testing](rn-testing.md) - Testing conventions for RN and Expo modules
- [Client Modules](client-modules.md) - Module naming taxonomy and the decision test
- [Client Loader](client-loader.md) - The `Lib` container and injection slots
- [Fonts](fonts.md) - Font delivery mechanisms through Expo
- [Module Structure](../module-structure.md) - Class I and Class H loader patterns
