import ax from 'axios';
import dotenv from 'dotenv';
import log from 'electron-log';
import { Transaction } from 'turtlecoin-utils';
import { sleep } from './sleep';

// load the environment variables
dotenv.config();

async function main() {
  while (true) {
    const infoRes = await ax.get('http://cuveetrtl.czech.cloud:11898/info');
    if (infoRes) {
      log.info('Current block ' + infoRes.data.height);
      const getRawBlocksRes = await ax.post(
        'http://cuveetrtl.czech.cloud:11898/getrawblocks',
        {
          startHeight: Number(infoRes.data.height) - 100,
        }
      );
      for (const block of getRawBlocksRes.data.items) {
        if (block.transactions.length > 0) {
          for (const transaction of block.transactions) {
            const tx: Transaction = Transaction.from(transaction);
            const prefix = tx.extra.toString('hex');
            if (prefix.includes('6b747828')) {
              console.log('bazinga! we got a karai pointer!');
              console.log(tx.extra.toString());
            }
          }
        }
      }
    } else {
      throw new Error('/info did not respond.');
    }

    await sleep(5000);
  }
}

main();
