import chalk from 'chalk';
import log from 'electron-log';
import http from 'http';
import WebSocket from 'ws';
import { WSS_PORT } from '..';

export class WebSocketServer {
  private server: http.Server;
  private wss: WebSocket.Server;
  private connections: any[];
  private blockHistory: any[];
  private txHistory: any[];
  private pointerHistory: any[];

  constructor() {
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    this.connections = [];
    this.blockHistory = [];
    this.txHistory = [];
    this.pointerHistory = [];
    this.init();
  }

  public getHistory(): any {
    const historyObject = {
      blockHistory: this.blockHistory,
      txHistory: this.txHistory,
      // tslint:disable-next-line: object-literal-sort-keys
      pointerHistory: this.pointerHistory,
    };
    return historyObject;
  }

  public broadcast(type: string, message: object) {
    const broadcastMessage = { type, message };
    if (type === 'block') {
      this.blockHistory.unshift(message);
      if (this.blockHistory.length > 20) {
        this.blockHistory.pop();
      }
    }
    if (type === 'tx') {
      this.txHistory.unshift(message);
      if (this.txHistory.length > 20) {
        this.txHistory.pop();
      }
    }
    if (type === 'pointer') {
      this.pointerHistory.unshift(message);
      if (this.pointerHistory.length > 20) {
        this.pointerHistory.pop();
      }
    }
    for (const connection of this.connections) {
      connection.send(JSON.stringify(broadcastMessage));
    }
  }

  private addConnection(connection: WebSocket) {
    this.connections.push(connection);
  }

  private init() {
    this.wss.on('connection', (ws: any) => {
      this.addConnection(ws);
      // on message handling
      ws.on('message', async (message: any) => {
        try {
          message = JSON.parse(message);
          console.log(message);
        } catch (error) {
          log.warn(error);
          ws.close();
        }
      });

      ws.on('close', () => {
        this.connections.splice(this.connections.indexOf(ws), 1);
      });

      ws.on('pong', () => this.heartbeat(ws));
    });

    this.server.listen(Number(WSS_PORT), () => {
      log.info('WS: listening on port ' + WSS_PORT);
    });

    setInterval(this.ping.bind(this), 30000);
  }

  private ping() {
    log.info(this.connections);
    for (const connection of this.connections) {
      if (connection.isAlive === false) {
        this.connections.splice(this.connections.indexOf(connection), 1);
        return connection.terminate();
      }

      connection.isAlive = false;
      connection.ping();
    }
  }

  private heartbeat(connection: any) {
    connection.isAlive = true;
  }
}
