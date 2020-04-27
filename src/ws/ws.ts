import chalk from 'chalk';
import log from 'electron-log';
import http from 'http';
import WebSocket from 'ws';
import { WSS_PORT } from '..';

export class WebSocketServer {
  private server: http.Server;
  private wss: WebSocket.Server;
  private connections: any[];

  constructor() {
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    this.connections = [];
    this.init();
  }

  public broadcast(type: string, message: object) {
    const broadcastMessage = { type, message };
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
  }

  private ping() {
    for (const connection of this.connections) {
      if (connection.isAlive === false) {
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
