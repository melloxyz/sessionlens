import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection.js';

export function registerModelRoutes(app: FastifyInstance): void {
  app.get('/api/models', async () => {
    const db = getDatabase();
    const results = db.exec(`SELECT * FROM models ORDER BY provider, model_name`);

    const data: Record<string, unknown>[] = [];
    if (results.length > 0 && results[0].values && results[0].columns) {
      const cols = results[0].columns;
      for (const row of results[0].values) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = row[i];
        }
        data.push(obj);
      }
    }

    return { data };
  });
}
