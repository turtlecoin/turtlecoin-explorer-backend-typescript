import chalk from 'chalk';
import log from 'electron-log';
import { version } from '../constants/version';

export function printAscii() {
  const ascii = `|   _   _  _  .\n               |( (_| |  (_| |\n`;
  log.info(chalk.green.bold(ascii));
  log.info(chalk.green.bold('karai-client ' + version));
}
