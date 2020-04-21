import ax from 'axios';
import dotenv from 'dotenv';
import log from 'electron-log';
import fs from 'fs';
import { Transaction } from 'turtlecoin-utils';
import { sleep } from './sleep';

const genesisBlock = 2472400;

if (!fs.existsSync('pointers.json')) {
  fs.writeFileSync('pointers.json', JSON.stringify([], null, 4));
}

const pointers = JSON.parse(fs.readFileSync('pointers.json', 'utf8'));

// load the environment variables
dotenv.config();

async function main() {
  let i = genesisBlock;
  while (true) {
    const infoRes = await ax.get('http://cuveetrtl.czech.cloud:11898/info');
    if (infoRes) {
      log.info('Network Block Height: ' + infoRes.data.height);
      log.info('Requesting blocks from ' + i.toString());
      const getRawBlocksRes = await ax.post(
        'http://cuveetrtl.czech.cloud:11898/getrawblocks',
        {
          startHeight: i,
        }
      );
      log.info(
        'Fetched ' +
          getRawBlocksRes.data.items.length.toString() +
          ' blocks from daemon.'
      );
      for (const block of getRawBlocksRes.data.items) {
        if (block.transactions.length > 0) {
          for (const transaction of block.transactions) {
            const tx: Transaction = Transaction.from(transaction);
            const hash = tx.extra.toString('hex');
            const prefix = '6b747828';
            if (hash.includes(prefix)) {
              const suffix = tx.extra
                .toString('hex')
                .split(prefix)[1]
                .substring(0, 14);
              const karaiPointer = prefix + suffix;
              if (!pointers.includes(karaiPointer)) {
                log.info(
                  'bazinga! we got a new karai pointer! ' + karaiPointer
                );
                pointers.push(karaiPointer);
                fs.writeFileSync(
                  'pointers.json',
                  JSON.stringify(pointers, null, 4)
                );
              }
            }
          }
        }
      }
      if (i < Number(infoRes.data.height) - 100) {
        i += 100;
      } else {
        i = Number(infoRes.data.height);
      }
    } else {
      throw new Error('/info did not respond.');
    }
    await sleep(5000);
  }
}

main();
