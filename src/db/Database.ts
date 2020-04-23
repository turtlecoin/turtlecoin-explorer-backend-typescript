import log from 'electron-log';
import knex from 'knex';

export class Database {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'sqlite3',
    connection: {
      filename: './db.sqlite',
    },
    useNullAsDefault: true,
  });

  constructor() {
    this.ready = false;
    this.init();
    this.reset = this.reset.bind(this);
  }

  public async reset() {
    const commands = [
      'DELETE FROM pointers;',
      'DELETE FROM sqlite_sequence WHERE name="pointers";',
      'DELETE FROM internal;',
    ];

    for (const command of commands) {
      await this.sql.raw(command);
    }
  }

  private async init() {
    const tables = await this.sql.raw(
      `SELECT name FROM sqlite_master
       WHERE type='table'
       ORDER BY name;`
    );
    const tableNames = tables.map((table: any) => table.name);

    if (!tableNames.includes('internal')) {
      await this.sql.raw(
        `CREATE TABLE "internal" (
           "syncHeight"	INTEGER
         );`
      );
    }
    if (!tableNames.includes('pointers')) {
      await this.sql.raw(
        `CREATE TABLE "pointers" (
          "id"	INTEGER PRIMARY KEY AUTOINCREMENT,
          "ascii"	TEXT,
          "hex"	TEXT UNIQUE,
          "block"	INTEGER,
          "transaction" TEXT,
          "timestamp" INTEGER
        );`
      );
    }
    this.ready = true;
    log.debug('Database opened successfully');
  }
}
