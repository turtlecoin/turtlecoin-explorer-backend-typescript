import ax from 'axios';
import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { Block, Transaction } from 'turtlecoin-utils';
import { DAEMON_URI, db, inputTaker } from '..';
import { turtleGenesisBlock } from '../constants/turtleConstants';
import { sleep } from '../utils/sleep';
// tslint:disable-next-line: no-var-requires
const sizeof = require('object-sizeof');
console.log(sizeof({ abc: 'def' }));

export class Monitor extends EventEmitter {
  public synced: boolean;
  private daemonURI: string;
  private checkpoints: string[];
  private blockStorage: any[];

  constructor() {
    super();
    this.daemonURI = DAEMON_URI!;
    this.synced = false;
    this.checkpoints = [turtleGenesisBlock];
    this.blockStorage = [];
    this.init();
  }

  public getSyncHeight(): number {
    return 0;
  }

  public getNetworkHeight(): number {
    return 0;
  }

  public getCheckpoints(): string[] {
    return this.checkpoints.slice(0, 100);
  }

  public addCheckpoint(hash: string) {
    this.checkpoints.unshift(hash);

    if (this.checkpoints.length > 10000) {
      this.checkpoints.pop();
    }
  }

  private async init() {
    let timeout = 1;
    while (!db.ready) {
      await sleep(timeout);
      timeout *= 2;
    }

    this.checkpoints = (
      await db
        .sql('blocks')
        .select('hash')
        .orderBy('height', 'desc')
        .limit(100)
    ).map((row) => row.hash);
    this.sync();
    this.process();
  }

  private async sync() {
    while (true) {
      const storageSize = sizeof(this.blockStorage) / 1048576;
      if (storageSize < 50) {
        log.debug(
          chalk.green.bold(
            `Stored block size: ${storageSize.toFixed(2)} Mb, fetching more`
          )
        );
      } else {
        await sleep(2000);
        continue;
      }

      let res;
      try {
        res = await ax.post(this.daemonURI + '/getrawblocks', {
          blockHashCheckpoints: this.getCheckpoints(),
        });
        try {
          const lastBlock = Block.from(
            res.data.items[res.data.items.length - 1].block
          );
          this.addCheckpoint(lastBlock.hash);
        } catch (error) {
          log.error('Could not parse last block in /getrawblocks response.');
          log.error(error);
        }
        for (const item of res.data.items) {
          this.blockStorage.unshift(item);
        }
      } catch (error) {
        log.error(error);
        await sleep(2000);
        continue;
      }
    }
  }

  private async process() {
    while (true) {
      let timeout = 1;
      while (this.blockStorage.length === 0) {
        await sleep(timeout);
        timeout *= 2;
      }
      try {
        await db.sql.transaction(async (trx) => {
          if (inputTaker.killswitch) {
            log.info('Thanks for stopping by!');
            process.exit(0);
          }
          const item = this.blockStorage.pop();
          const block = Block.from(item.block);
          try {
            await db.storeBlock(block, trx);
          } catch (error) {
            log.warn('Block parsing / storing failure!');
            log.warn(error);
            log.warn(item.block);
            throw error;
          }

          for (const tx of item.transactions) {
            try {
              const transaction: Transaction = Transaction.from(tx);
              await db.storeTransaction(transaction, block, trx);
            } catch (error) {
              log.warn('transaction parsing failure!');
              log.warn('Problematic transaction is in block ' + block.hash);
              log.warn(tx);
              log.warn(error);
              throw error;
            }
          }
        });
      } catch (error) {
        log.error(error);
      }
    }
  }
}
