import chalk from 'chalk';
import { EventEmitter } from 'events';
import readline, { createInterface } from 'readline';
import { db, monitor } from '..';

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

  private async action(command: string) {
    switch (command) {
      case 'status':
        console.log(
          chalk.bold.green('\n************************') +
            chalk.bold.green('\n*        STATUS        *') +
            chalk.bold.green('\n************************') +
            '\nSync Height:    ' +
            chalk.yellow.bold(monitor.getSyncHeight()) +
            '\nNetwork Height: ' +
            chalk.yellow.bold(monitor.getNetworkHeight()) +
            '\nSynced:         ' +
            (monitor.synced
              ? chalk.green.bold('Yes\n')
              : chalk.red.bold('No\n'))
        );
        break;
      case 'reset':
        console.log('Resetting sync status. Please wait while we resync.');
        await db.reset();
        this.emit('reset');
        break;
      case 'exit':
        console.log('Thanks for stopping by...');
        process.exit(0);
      default:
        console.log(`Can't find a command ${command}.`);
        break;
    }
  }
}
