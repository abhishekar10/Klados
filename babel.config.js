module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Inlines db/migrations/*.sql as string literals for drizzle-orm's Expo migrator
      // (db/migrator.ts) — Metro can't parse raw SQL as JS on its own.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
