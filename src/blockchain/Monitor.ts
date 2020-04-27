import ax from 'axios';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { Block, Transaction } from 'turtlecoin-utils';
import { DAEMON_URI, db, inputTaker } from '..';
import { turtleGenesisBlock } from '../constants/turtleConstants';
import { sleep } from '../utils/sleep';

export class Monitor extends EventEmitter {
  public synced: boolean;
  private daemonURI: string;
  private checkpoints: string[];

  constructor() {
    super();
    this.daemonURI = DAEMON_URI!;
    this.synced = false;
    this.checkpoints = [turtleGenesisBlock];
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

    await db.cleanup(2);

    this.checkpoints = (
      await db
        .sql('blocks')
        .select('hash')
        .orderBy('height', 'desc')
        .limit(100)
    ).map((row) => row.hash);

    this.sync();
  }

  private async sync() {
    while (true) {
      let res;
      try {
        res = await ax.post(this.daemonURI + '/getrawblocks', {
          blockHashCheckpoints: this.getCheckpoints(),
        });
      } catch (error) {
        log.error(error);
        await sleep(2000);
        continue;
      }

      for (const item of res.data.items) {
        if (inputTaker.killswitch) {
          log.info('Thanks for stopping by!');
          process.exit(0);
        }
        const block = Block.from(item.block);
        try {
          await db.storeBlock(block);
        } catch (error) {
          db.cleanup();
          continue;
        }

        for (const tx of item.transactions) {
          const transaction: Transaction = Transaction.from(tx);
          try {
            await db.storeTransaction(transaction, block);
          } catch (error) {
            db.cleanup();
            continue;
          }
        }

        this.addCheckpoint(block.hash);
      }
    }
  }
}
