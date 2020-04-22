import knex from 'knex';

// tslint:disable-next-line: no-var-requires
export const sql = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite',
  },
  useNullAsDefault: true,
});
