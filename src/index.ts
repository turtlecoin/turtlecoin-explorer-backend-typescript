import { API } from './api/api';
import { Monitor } from './blockchain/Monitor';
import { Database } from './db/Database';
import { InputTaker } from './input/InputTaker';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';

// tslint:disable-next-line: no-var-requires
const fxLog = require('why-is-node-running');

setTimeout(() => {
  fxLog();
}, 1000);

printAscii();
setupEnv();
const { DAEMON_URI, API_PORT } = process.env;
export const db = new Database();
export const monitor = new Monitor(DAEMON_URI!);
export const inputTaker = new InputTaker();
export const api = new API(Number(API_PORT!));
