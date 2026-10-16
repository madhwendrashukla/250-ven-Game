/** Test helper: an in-process Postgres (PGlite) behind the store's PgClient interface. Not used by the app. */
import { PGlite } from '@electric-sql/pglite';
import type { PgClient } from './pg';

export async function pgliteClient(): Promise<PgClient> {
  const db = await PGlite.create();
  return {
    query: async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows,
    exec: async (text) => {
      await db.exec(text);
    },
    end: () => db.close(),
  };
}
