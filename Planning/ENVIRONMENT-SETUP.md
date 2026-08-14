# Environment Setup (Linux, Android-only)

Everything needed to go from a clean Linux machine to "ready to write code" for Klados. No project code is bootstrapped by this document — it only gets the machine ready. Project bootstrap (§5 below) is the actual first step of implementation, documented here for reference.

---

## 1. Required installs

| Tool | Why |
|---|---|
| **Node.js (LTS, via `nvm`)** | Runs Expo CLI, Metro bundler, Jest, everything JS-side. Use `nvm` rather than a system package so the Node version is per-project-controllable. |
| **Java 17 JDK** | Android's Gradle build system requires a JDK to compile the native shell app, even in Expo's managed workflow, once you get to `eas build --local`. |
| **Android Studio** | Provides the Android SDK, `platform-tools` (`adb`), and the AVD Manager for creating an emulator. Needed even if you mostly test on a physical phone, because the SDK/`adb` come bundled with it. |
| **Android Virtual Device (AVD)** | Set up at least one emulator (e.g. Pixel 7, API 34) via Android Studio's Device Manager, for testing without a physical phone. |
| **`eas-cli`** (`npm install -g eas-cli`) | Only needed once you reach export — see [`BUILD-AND-EXPORT.md`](./BUILD-AND-EXPORT.md). Not a per-project dependency, install globally. |

### Environment variables

After installing Android Studio, set (typically in `~/.bashrc` or `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

Android Studio's own SDK Manager UI shows the exact install path if `$HOME/Android/Sdk` doesn't match.

### Not needed (Android-only scope)

- Xcode / iOS Simulator — Mac-only, not applicable here.
- Apple Developer account — only relevant for iOS distribution, out of scope.
- Watchman — primarily a macOS optimization for Metro's file watching; Linux works fine without it, can be skipped.

---

## 2. Editor tooling (VS Code)

Recommended extensions, since this project is worked in VS Code / the Claude Code VS Code extension:

- **ESLint** — lint-on-save against the project's config.
- **Prettier** — format-on-save, consistent with the rest of the team-of-one's style.
- **Tailwind CSS IntelliSense** — autocompletes NativeWind's Tailwind class names in `className` props.
- **React Native Tools** (Microsoft) — debugging, IntelliSense for RN APIs.
- **Expo Tools** — Expo-specific config/schema support (`app.json`, `eas.json`).
- **An SQLite viewer extension** (e.g. "SQLite Viewer") — lets you open the on-device `.db` file pulled via `adb` to inspect the `goals`/`completion_log` tables directly during development, instead of only querying through app code.

---

## 3. Physical-device testing path

In addition to (or instead of) the emulator:

1. Install **Expo Go** from the Play Store on an Android phone.
2. Ensure the phone and dev machine are on the same Wi-Fi network.
3. `npx expo start` prints a QR code — scan it from Expo Go.
4. If the network blocks LAN discovery, `npx expo start --tunnel` routes through Expo's tunnel service instead.

This is the fastest inner loop for real-device behavior (touch targets, animation feel) without needing a full native build.

---

## 4. Verify setup checklist

Run before writing any code, to confirm the machine is actually ready:

```bash
node -v            # LTS version, e.g. v20.x
npm -v
java -version      # 17.x
adb devices        # lists emulator/phone once one is running/connected
eas --version       # confirms eas-cli installed
```

If `adb devices` shows nothing, either start an AVD from Android Studio's Device Manager or plug in / connect a phone with USB debugging enabled (Settings → Developer Options).

---

## 5. Project bootstrap (reference — first step of actual implementation, not run yet)

Run from the repo root (`/home/abhishek/Desktop/Klados`, alongside the existing `Planning/` and `.claude/` folders) — target `.` rather than a new subfolder name, so the Expo project lives at the repo root instead of nesting a second `klados/` directory inside this one:

```bash
npx create-expo-app@latest . --template expo-template-blank-typescript
npx expo install expo-sqlite react-native-reanimated
npm install nativewind zustand moti
npm install -D tailwindcss drizzle-kit
npm install drizzle-orm
```

Then wire up `tailwind.config.js` / `nativewind`'s Babel plugin per NativeWind's setup docs, and scaffold the folder layout from [`TECH-STACK.md`](./TECH-STACK.md) §3.
