const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// drizzle-kit's Expo migrator imports raw .sql migration files at build time.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
