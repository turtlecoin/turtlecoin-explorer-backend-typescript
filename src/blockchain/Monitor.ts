import ax from 'axios';
import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { Transaction } from 'turtlecoin-utils';
import { genesisBlock, prefix, suffix } from '../constants/karaiConstants';
import { Database } from '../db/Database';
import { InputTaker } from '../input/InputTaker';
import { hexToIp, hexToPort } from '../utils/hexHelpers';
import { sleep } from '../utils/sleep';

export class Monitor extends EventEmitter {
  private daemonURI: string;
  private infoRes: any;
  private synced: boolean;
  private firstSync: boolean;
  private db: Database;
  constructor(db: Database, daemonURI: string, inputTaker: InputTaker) {
    super();
    this.daemonURI = daemonURI;
    this.infoRes = null;
    this.synced = false;
    this.firstSync = false;
    this.db = db;
    this.init(inputTaker);
  }

  public async init(inputTaker: InputTaker) {
    const optionsQuery = await this.db.sql('internal').select();

    if (optionsQuery.length === 0) {
      await this.db.sql('internal').insert({});
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
            chalk.green(
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
              const peer = tx.extra
                .toString('hex')
                .split(prefix)[1]
                .substring(0, 12);
              const hex = prefix + peer + suffix;
              const peerIP = hexToIp(peer.substring(0, 8));
              const port = hexToPort(peer.substring(8, 12));

              const ascii = `${peerIP}:${port.toString()}`;

              log.debug(
                'New karai pointer found:        ' + chalk.yellow.bold(ascii)
              );
              try {
                await this.db.sql('pointers').insert({ hex, ascii });
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
      await this.db.sql('internal').update({ syncHeight: i });
    }
  }
}
