import chalk from 'chalk';
import log from 'electron-log';
import { version } from '../constants/version';

export function printAscii() {
  const ascii = `|   _   _  _  .\n               |( (_| |  (_| |\n`;
  log.debug(chalk.green.bold(ascii));
  log.debug(chalk.green.bold('karai-client ' + version));
}
