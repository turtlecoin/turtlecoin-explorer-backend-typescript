import { API } from './api/api';
import { Monitor } from './blockchain/Monitor';
import { Database } from './db/Database';
import { InputTaker } from './input/InputTaker';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';
import { WebSocketServer } from './ws/ws';

printAscii();
setupEnv();

export const { DAEMON_URI, API_PORT, WSS_PORT } = process.env;
export const db = new Database();
export const monitor = new Monitor();
export const inputTaker = new InputTaker();
export const api = new API();
export const wss = new WebSocketServer();
