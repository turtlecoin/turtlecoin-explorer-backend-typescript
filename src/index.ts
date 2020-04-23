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
export const db = new Database();
let timeout = 1;
(async () => {
  while (db.ready !== true) {
    await sleep(1);
    timeout *= 2;
  }
})();
export const inputTaker = new InputTaker();
export const monitor = new Monitor(DAEMON_URI!);
export const api = new API(Number(API_PORT!));
