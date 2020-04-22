import knex from 'knex';

// tslint:disable-next-line: no-var-requires
export const sql = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite',
  },
  useNullAsDefault: true,
});

export async function reset() {
  await sql.raw(`
    DELETE FROM pointers;
    DELETE FROM sqlite_sequence WHERE name="pointers";
    DELETE FROM internal;
  `);
}

// DELETE FROM pointers;
// DELETE FROM sqlite_sequence WHERE name="pointers";
// DELETE FROM internal;
