import { API } from './api/api';
import { Monitor } from './blockchain/Monitor';
import { InputTaker } from './input/InputTaker';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';

printAscii();
setupEnv();
const { DAEMON_URI, API_PORT } = process.env;

async function main() {
  const inputTaker = new InputTaker();
  const api = new API(Number(API_PORT!));
  const monitor = new Monitor(DAEMON_URI!, inputTaker);
}

main();
