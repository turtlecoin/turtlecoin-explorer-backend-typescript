import ax from 'axios';
import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { Block, Transaction } from 'turtlecoin-utils';
import { db, inputTaker } from '..';
import { genesisBlock, prefix, suffix } from '../constants/karaiConstants';
import { hexToIp, hexToPort } from '../utils/hexHelpers';
import { sleep } from '../utils/sleep';

export class Monitor extends EventEmitter {
  public synced: boolean;
  private daemonURI: string;
  private infoRes: any;
  private firstSync: boolean;
  private syncHeight: number;
  private networkHeight: number | null;
  constructor(daemonURI: string) {
    super();
    this.daemonURI = daemonURI;
    this.infoRes = null;
    this.firstSync = false;
    this.syncHeight = genesisBlock;
    this.synced = false;
    this.networkHeight = null;
    this.init();
  }

  public getSyncHeight() {
    return this.syncHeight;
  }

  public getNetworkHeight() {
    return this.networkHeight;
  }

  public async init() {
    const optionsQuery = await db.sql('internal').select();

    if (optionsQuery.length === 0) {
      await db.sql('internal').insert({});
    }
    const [options] = optionsQuery;

    this.syncHeight =
      options && options.syncHeight ? options.syncHeight : genesisBlock;
    inputTaker.on('reset', () => {
      // tslint:disable-next-line: ban-comma-operator
      return (this.syncHeight = genesisBlock), (this.firstSync = false);
    });
    this.infoRes = await ax.get(this.daemonURI + '/info');
    setInterval(async () => {
      this.infoRes = await ax.get(this.daemonURI + '/info');
    }, 10000);

    while (true) {
      this.networkHeight = this.infoRes.data.height;
      if (this.infoRes.data.height === this.syncHeight) {
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
        if (this.synced) {
          log.debug(`New block found: ${this.infoRes.data.height}`);
        }
        this.synced = false;
      }
      const getRawBlocksRes = await ax.post(this.daemonURI + '/getrawblocks', {
        startHeight: this.syncHeight,
      });
      if (!this.firstSync) {
        log.debug(
          'Fetched ' +
            getRawBlocksRes.data.items.length.toString() +
            ' blocks from daemon. ' +
            chalk.green(
              this.syncHeight.toString() +
                ' / ' +
                this.infoRes.data.height.toString()
            )
        );
      }
      for (const blockData of getRawBlocksRes.data.items) {
        // log.info(block);
        if (blockData.transactions.length > 0) {
          for (const transaction of blockData.transactions) {
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

              const ascii = `ktx://${peerIP}:${port.toString()}`;

              log.debug(
                'New karai pointer found:        ' + chalk.yellow.bold(ascii)
              );

              const block = Block.from(blockData.block);
              try {
                await db.sql('pointers').insert({
                  ascii,
                  block: block.hash,
                  hex,
                  timestamp: block.timestamp,
                  transaction: tx.hash,
                });
              } catch (error) {
                if (error.errno && error.errno !== 19) {
                  throw new Error(error);
                }
              }
            }
          }
        }
      }
      if (this.syncHeight < Number(this.infoRes.data.height) - 100) {
        this.syncHeight += 100;
      } else {
        this.syncHeight = Number(this.infoRes.data.height);
      }
      await db.sql('internal').update({ syncHeight: this.syncHeight });
    }
  }
}
