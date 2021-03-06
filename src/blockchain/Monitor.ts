import ax from 'axios';
import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Block, Transaction } from 'turtlecoin-utils';
import { DAEMON_URI, db, inputTaker } from '..';
import { turtleGenesisBlock } from '../constants/turtleConstants';
import { arrayAverage } from '../utils/arrayAverage';
import { sleep } from '../utils/sleep';
// tslint:disable-next-line: no-var-requires
const sizeof = require('object-sizeof');

export class Monitor extends EventEmitter {
  public synced: boolean;
  public isSyncing: boolean;
  private daemonURI: string;
  private checkpoints: string[];
  private blockStorage: any[];
  private speedData: number[];

  constructor() {
    super();
    this.daemonURI = DAEMON_URI!;
    this.synced = false;
    this.isSyncing = false;
    this.checkpoints = [turtleGenesisBlock];
    this.blockStorage = [];
    this.speedData = [];
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

  private async initCheckpoints(): Promise<void> {
    this.checkpoints = (
      await db
        .sql('blocks')
        .select('hash')
        .orderBy('height', 'desc')
        .limit(100)
    ).map((row) => row.hash);
  }

  private async init() {
    let timeout = 1;
    while (!db.ready) {
      await sleep(timeout);
      timeout *= 2;
    }

    await this.initCheckpoints();

    this.sync();
    this.process();
  }

  private async sync() {
    while (true) {
      const storageSize = sizeof(this.blockStorage) / 1048576;
      if (storageSize < 50) {
        log.debug(
          chalk.green.bold(
            `stored  blocks ${storageSize.toFixed(2)} Mb, fetching more`
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
          if (res.data.items.length > 0) {
            const lastBlock = Block.from(
              res.data.items[res.data.items.length - 1].block
            );
            this.addCheckpoint(lastBlock.hash);
          } else {
            log.info('No blocks returned. Waiting...');
            await sleep(5000);
            continue;
          }
        } catch (error) {
          console.warn(error);
        }
        this.blockStorage.unshift(res.data.items);
      } catch (error) {
        log.error(error);
        await sleep(2000);
        continue;
      }
    }
  }

  private async process() {
    while (true) {
      if (inputTaker.killswitch) {
        log.info('Thanks for stopping by!');
        process.exit(0);
      }

      while (this.blockStorage.length === 0) {
        await sleep(500);
      }

      const startTime = performance.now();
      try {
        let items = null;
        if (this.blockStorage.length > 0) {
          this.isSyncing = true;
          try {
            await db.sql.transaction(async (trx) => {
              items = this.blockStorage.pop();
              for (const item of items) {
                let block: Block | null;
                try {
                  block = Block.from(item.block);
                } catch (error) {
                  log.warn('Problem parsing block!');
                  log.warn(item.block);
                  throw error;
                }

                try {
                  await db.storeBlock(block, trx);
                } catch (error) {
                  if (error.code === 'ERROR_DUP_ENTRY') {
                    trx.destroy();
                  }

                  log.warn('Block storage failure!');
                  log.warn(item.block);
                  log.warn(block);
                }

                for (const tx of item.transactions) {
                  let transaction: Transaction | null;
                  try {
                    transaction = Transaction.from(tx);
                  } catch (error) {
                    log.warn('transaction parsing failure!');
                    log.warn(
                      'Problematic transaction is in block ' + block.hash
                    );
                    log.warn(tx);
                    if (error.errno !== 19) {
                      throw error;
                    }
                  }
                  try {
                    await db.storeTransaction(transaction!, block, trx);
                  } catch (error) {
                    log.warn('Problem storing transaction!');
                    log.warn(tx);
                    log.warn(transaction!);
                    throw error;
                  }
                }
              }
              await trx.commit();
              this.isSyncing = false;
            });
          } catch (error) {
            log.error(error);
            await db.cleanup();
            this.isSyncing = false;
          }
        } else {
          log.debug('Block storage empty. Waiting...');
          await sleep(5000);
        }
      } catch (error) {
        throw error;
      }
      const endTime = performance.now();
      const processTime = (endTime - startTime) / 1000;

      this.speedData.push(processTime);
      if (this.speedData.length > 10000) {
        this.speedData.shift();
      }
      log.debug(
        chalk.yellow.bold(`PERFORMANCE`),
        `average ${arrayAverage(this.speedData)} seconds per 100 blocks `
      );
    }
  }
}
