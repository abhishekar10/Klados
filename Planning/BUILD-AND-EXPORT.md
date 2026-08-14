# Build & Export (Android)

How to run Klados during development, and how to produce the final installable `.apk`. Android-only — see [`TECH-STACK.md`](./TECH-STACK.md) for why.

---

## 1. Dev loop (daily use)

```bash
npx expo start
```

- Scan the printed QR code with **Expo Go** on a physical Android phone (see [`ENVIRONMENT-SETUP.md`](./ENVIRONMENT-SETUP.md) §3), or
- Press `a` in the terminal to launch on a running Android emulator (AVD started from Android Studio's Device Manager).

This is the loop for nearly all development — fast refresh, no native build step. It has one limitation: it can't test anything that requires a real compiled binary (final app icon/splash, standalone launch without the Expo Go wrapper). That's what export (§2) is for, done occasionally, not every iteration.

---

## 2. Producing an installable `.apk`

### 2.1 One-time setup

```bash
npm install -g eas-cli
eas login          # requires a free Expo account — only used for the build service/config, not runtime
eas build:configure
```

This generates `eas.json` with build profiles. Edit it to look roughly like:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "apk" }
    }
  }
}
```

The key line is `"buildType": "apk"` — by default EAS builds an `.aab` (Android App Bundle), which is what the Play Store wants but **cannot be sideloaded directly**. Since there's no Play Store distribution here (brief §11: "Android can install an `.apk` directly with no account needed"), every profile should produce a raw `.apk`.

### 2.2 Building

**Cloud build (default, needs network + Expo account, but works even if the local Android SDK isn't fully set up):**

```bash
eas build --platform android --profile preview
```

Uploads the project, builds remotely, gives a download link for the `.apk` when done.

**Local build (stays fully on-device, no cloud dependency — preferred here given the project's local-first philosophy):**

```bash
eas build --platform android --profile preview --local
```

Requires the Android SDK + Java 17 set up per [`ENVIRONMENT-SETUP.md`](./ENVIRONMENT-SETUP.md) §1 (this is exactly what those installs are for). Produces the `.apk` directly in the project directory — no upload, no cloud build minutes consumed, matches "the app is local, the build process can be too."

Use `--local` as the default; fall back to the cloud build only if local build tooling has an issue worth not debugging immediately.

### 2.3 Installing the built APK

With a device connected via `adb` (USB debugging enabled, or over the same network via `adb connect`):

```bash
adb install path/to/build.apk
```

Or, without `adb`: copy the `.apk` file to the phone (USB file transfer, or any file-sharing method) and open it directly from a file manager — Android will prompt to allow installation from that source the first time (Settings → "Install unknown apps" for that source).

---

## 3. Before a "final" export

Per the brief's roadmap (§10, Phase 3 — "Polish/animation pass, app icon/splash screen, EAS Build for an installable binary"), don't treat the first successful `.apk` as final. Before calling a build the production one:

- [ ] App icon and splash screen configured in `app.json` (not the Expo default).
- [ ] App name/version bumped appropriately in `app.json`.
- [ ] Full manual regression pass from [`TESTING.md`](./TESTING.md) run against the actual built `.apk` on a device (not just Expo Go — the standalone binary can behave subtly differently, e.g. around SQLite file paths or asset bundling).
- [ ] Confirmed zero network calls in the standalone build specifically (rebuilding can occasionally reintroduce a dependency that phones home; recheck, don't assume it's still true from an earlier Expo Go check).

---

## 4. Backup reminder

Per brief §11, there's no cloud copy of user data — losing the device means losing everything in the SQLite database. Export/import (JSON backup) is listed as a stretch feature in brief §10 but flagged there as worth prioritizing higher than "stretch" given this tradeoff. Worth building before treating any build as the one to rely on daily.
