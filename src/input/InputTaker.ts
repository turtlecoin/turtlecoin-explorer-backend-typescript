import log from 'electron-log';
import { EventEmitter } from 'events';
import readline, { createInterface } from 'readline';
import { db } from '..';

export class InputTaker extends EventEmitter {
  public killswitch: boolean;
  private rl: readline.Interface;

  constructor() {
    super();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.killswitch = false;
    this.handleCommand = this.handleCommand.bind(this);
    this.init();
  }

  private init() {
    this.rl.on('SIGINT', () => {
      this.rl.close();
      this.killswitch = true;
    });

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
        await db.reset();
        this.emit('reset');
        break;
      case 'exit':
        this.killswitch = true;
        break;
      default:
        log.info(`Can't find a command ${command}.`);
        break;
    }
  }
}
