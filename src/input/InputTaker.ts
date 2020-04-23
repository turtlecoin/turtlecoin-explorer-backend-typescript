import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import readline, { createInterface } from 'readline';
import { Database } from '../db/Database';

export class InputTaker extends EventEmitter {
  public reset: () => void;
  private rl: readline.Interface;
  constructor(db: Database) {
    super();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.handleCommand = this.handleCommand.bind(this);
    this.init();
    this.reset = db.reset;
  }

  private init() {
    this.rl.question('', this.handleCommand);
  }

  private handleCommand(command: string) {
    this.action(command);
    this.rl.question('', this.handleCommand);
  }

  private async action(command: string) {
    switch (command) {
      case 'reset':
        log.info('Resetting sync status. Please wait while we resync.');
        await this.reset();
        this.emit('reset');
        break;
      case 'exit':
        log.info('Thanks for stopping by...');
        process.exit(0);
      default:
        log.warn(`Can't find a command ${command}.`);
        break;
    }
  }
}
