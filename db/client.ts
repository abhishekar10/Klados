import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const expoDb = openDatabaseSync('klados.db', { enableChangeListener: true });

// SQLite disables foreign-key enforcement per connection by default — without this,
// the schema's onDelete: 'cascade'/'set null' rules (db/schema.ts) are silently ignored,
// so verify it actually took rather than assuming the PRAGMA was accepted.
expoDb.execSync('PRAGMA foreign_keys = ON;');
const [{ foreign_keys: foreignKeysEnabled }] = expoDb.getAllSync<{ foreign_keys: number }>(
  'PRAGMA foreign_keys;',
);
if (foreignKeysEnabled !== 1) {
  throw new Error('Failed to enable SQLite foreign-key enforcement — cascade deletes would silently no-op.');
}

export const db = drizzle(expoDb, { schema });
export { expoDb };
