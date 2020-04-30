import log from 'electron-log';
import { API } from './api/api';
import { Monitor } from './blockchain/Monitor';
import { Database } from './db/Database';
import { InputTaker } from './input/InputTaker';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';
import { WebSocketServer } from './ws/ws';

printAscii();
setupEnv();

export let rewindBlocks: number | null = null;

for (const arg of process.argv) {
  log.info(arg);
  if (arg === '--rewind') {
    rewindBlocks = Number(process.argv[process.argv.indexOf(arg) + 1]);
  }
}

export const { DAEMON_URI, API_PORT, WSS_PORT } = process.env;
export const db = new Database();
export const monitor = new Monitor();
export const inputTaker = new InputTaker();
export const api = new API();
export const wss = new WebSocketServer();
