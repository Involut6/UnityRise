import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { config } from './config';
import { Pool, PoolClient } from 'pg';

export type Q = <T = any>(sql: string, params?: any[]) => Promise<T[]>;

@Injectable()
export class Db implements OnModuleDestroy {
  // Serverless: many short-lived instances, so keep each pool tiny (use Neon's pooled connection string).
  pool = new Pool({ connectionString: config().databaseUrl, max: process.env.VERCEL ? 2 : 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
  q: Q = async (sql, params) => (await this.pool.query(sql, params)).rows;
  one = async <T = any>(sql: string, params?: any[]) => (await this.q<T>(sql, params))[0];
  /** Run fn in a transaction; fn receives a query function bound to the tx connection. */
  async tx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
    const c: PoolClient = await this.pool.connect();
    try {
      await c.query('begin');
      const r = await fn(async (sql, params) => (await c.query(sql, params)).rows);
      await c.query('commit');
      return r;
    } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  }
  onModuleDestroy() { return this.pool.end(); }
}
@Global() @Module({ providers: [Db], exports: [Db] }) export class DbModule {}
