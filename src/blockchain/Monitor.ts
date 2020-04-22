import ax from 'axios';
import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { Transaction } from 'turtlecoin-utils';
import { genesisBlock, prefix } from '../constants/karaiConstants';
import { sql } from '../db/sql';
import { InputTaker } from '../input/InputTaker';
import { sleep } from '../utils/sleep';

export class Monitor extends EventEmitter {
  private daemonURI: string;
  private infoRes: any;
  private synced: boolean;
  private firstSync: boolean;
  constructor(daemonURI: string, inputTaker: InputTaker) {
    super();
    this.daemonURI = daemonURI;
    this.infoRes = null;
    this.synced = false;
    this.firstSync = false;
    this.init(inputTaker);
  }

  public async init(inputTaker: InputTaker) {
    const optionsQuery = await sql('internal').select();
    if (optionsQuery.length === 0) {
      await sql('internal').insert({});
    }

    const [options] = optionsQuery;
    let i = options && options.syncHeight ? options.syncHeight : genesisBlock;
    inputTaker.on('reset', () => {
      // tslint:disable-next-line: ban-comma-operator
      return (i = genesisBlock), (this.firstSync = false);
    });
    this.infoRes = await ax.get(this.daemonURI + '/info');
    setInterval(async () => {
      this.infoRes = await ax.get(this.daemonURI + '/info');
    }, 10000);

    while (true) {
      if (this.infoRes.data.height === i) {
        this.synced = true;
        if (!this.firstSync) {
          log.debug(
            chalk.green.bold(
              'You have successfully synchronized with the TurtleCoin network.'
            )
          );
          this.firstSync = true;
        }
        await sleep(5000);
        continue;
      } else {
        this.synced = false;
      }
      const getRawBlocksRes = await ax.post(this.daemonURI + '/getrawblocks', {
        startHeight: i,
      });
      if (!this.firstSync) {
        log.debug(
          'Fetched ' +
            getRawBlocksRes.data.items.length.toString() +
            ' blocks from daemon. ' +
            chalk.yellow.bold(
              i.toString() + ' / ' + this.infoRes.data.height.toString()
            )
        );
      }
      for (const block of getRawBlocksRes.data.items) {
        if (block.transactions.length > 0) {
          for (const transaction of block.transactions) {
            const tx: Transaction = Transaction.from(transaction);
            const txExtra = tx.extra.toString('hex');
            if (txExtra.includes(prefix)) {
              const suffix = tx.extra
                .toString('hex')
                .split(prefix)[1]
                .substring(0, 14);
              const karaiPointer = prefix + suffix;
              log.debug(
                'New karai pointer found:        ' +
                  chalk.green.bold(karaiPointer)
              );
              try {
                await sql('pointers').insert({ hex: karaiPointer });
              } catch (error) {
                if (error.errno && error.errno !== 19) {
                  throw new Error(error);
                }
              }
            }
          }
        }
      }
      if (i < Number(this.infoRes.data.height) - 100) {
        i += 100;
      } else {
        i = Number(this.infoRes.data.height);
      }
      await sql('internal').update({ syncHeight: i });
    }
  }
}
