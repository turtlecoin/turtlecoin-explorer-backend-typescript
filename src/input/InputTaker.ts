import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import readline, { createInterface } from 'readline';
import { reset } from '../db/sql';

export class InputTaker extends EventEmitter {
  private rl: readline.Interface;
  constructor() {
    super();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.handleCommand = this.handleCommand.bind(this);
    this.init();
  }

  private init() {
    this.rl.question('', this.handleCommand);
  }

  private handleCommand(command: string) {
    this.action(command);
    this.rl.question('', this.handleCommand);
  }

  private action(command: string) {
    switch (command) {
      case 'reset':
        this.rl.question(
          chalk.yellow.bold(
            'Are you sure you want to reset? This will wipe your sync progress and all stored karai pointers. (Y/n) '
          ),
          async (confirmation: string) => {
            if (confirmation.toUpperCase() === 'Y') {
              log.info('Resetting sync to karai genesis block.');
              await reset();
              this.emit('reset');
            } else {
              return;
            }
          }
        );
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
