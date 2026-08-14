const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// drizzle-kit's Expo migrator imports raw .sql migration files at build time.
config.resolver.sourceExts.push('sql');

// inlineRem: false — without this, NativeWind bakes every rem-based utility class (text-*,
// p-*, gap-*, rounded-*, ...) into a static pixel number at build time, and app/_layout.tsx's
// runtime rem.set() (the Settings "Text size" control) would have nothing left to affect.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: false });
