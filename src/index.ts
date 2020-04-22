import { API } from './api/api';
import { Monitor } from './blockchain/Monitor';
import { Database } from './db/Database';
import { InputTaker } from './input/InputTaker';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';
import { sleep } from './utils/sleep';

printAscii();
setupEnv();
const { DAEMON_URI, API_PORT } = process.env;

async function main() {
  const db = new Database();
  let timeout = 1;
  while (db.ready !== true) {
    await sleep(1);
    timeout *= 2;
  }
  const inputTaker = new InputTaker(db);
  const api = new API(db, Number(API_PORT!));
  const monitor = new Monitor(db, DAEMON_URI!, inputTaker);
}

main();
