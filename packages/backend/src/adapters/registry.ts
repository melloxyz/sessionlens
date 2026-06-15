import type { Adapter, Checkpoint } from './types.js';
import { getDatabase } from '../db/connection.js';

export class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();

  register(adapter: Adapter): void {
    this.adapters.set(adapter.cli, adapter);
  }

  get(cli: string): Adapter | undefined {
    return this.adapters.get(cli);
  }

  getAll(): Adapter[] {
    return [...this.adapters.values()];
  }

  clear(): void {
    this.adapters.clear();
  }

  saveCheckpoint(cli: string, sessionPath: string, checkpoint: Checkpoint): void {
    const db = getDatabase();
    db.run(
      `INSERT OR REPLACE INTO __checkpoints (cli, session_path, last_file_mtime, last_file_size, last_session_id) VALUES (?, ?, ?, ?, ?)`,
      [
        cli,
        sessionPath,
        checkpoint.lastFileMtime,
        checkpoint.lastFileSize,
        checkpoint.lastSessionId,
      ],
    );
  }

  getCheckpoint(cli: string, sessionPath: string): Checkpoint | null {
    const db = getDatabase();
    const result = db.exec(
      `SELECT last_file_mtime, last_file_size, last_session_id FROM __checkpoints WHERE cli = ? AND session_path = ?`,
      [cli, sessionPath],
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    const [mtime, size, id] = result[0].values[0];
    return {
      lastFileMtime: Number(mtime),
      lastFileSize: Number(size),
      lastSessionId: id as string | null,
    };
  }
}

export const registry = new AdapterRegistry();
