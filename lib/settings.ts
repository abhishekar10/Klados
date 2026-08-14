import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import { settings } from '../db/schema';

export type Settings = typeof settings.$inferSelect;

const SETTINGS_ROW_ID = 1;

/** Reads the single settings row, creating it with defaults on first run. */
export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, SETTINGS_ROW_ID));
  if (rows[0]) return rows[0];
  const [row] = await db.insert(settings).values({ id: SETTINGS_ROW_ID }).returning();
  return row;
}

export async function updateSettings(updates: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  await getSettings(); // ensure the row exists before updating it
  const [row] = await db
    .update(settings)
    .set(updates)
    .where(eq(settings.id, SETTINGS_ROW_ID))
    .returning();
  return row;
}
