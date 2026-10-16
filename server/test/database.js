import { PGlite } from '@electric-sql/pglite';

// Test-only PostgreSQL engine. Never used as a production fallback or connected to DATABASE_URL.
export class TestPool {
  constructor() {
    this.engine = new PGlite();
    this.queue = Promise.resolve();
  }
  async connect() {
    const before = this.queue;
    let release;
    this.queue = new Promise((resolve) => {
      release = resolve;
    });
    await before;
    return { query: (sql, values = []) => this.raw(sql, values), release };
  }
  async raw(sql, values = []) {
    const result =
      !values.length && sql.includes(';')
        ? (await this.engine.exec(sql)).at(-1)
        : await this.engine.query(sql, values);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
      command: sql.trim().split(/\s/)[0].toUpperCase(),
    };
  }
  async query(sql, values = []) {
    const client = await this.connect();
    try {
      return await client.query(sql, values);
    } finally {
      client.release();
    }
  }
  async end() {
    await this.engine.close();
  }
}
