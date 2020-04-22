import ax from 'axios';
import bodyParser from 'body-parser';
import chalk from 'chalk';
import cors from 'cors';
import log from 'electron-log';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { Transaction } from 'turtlecoin-utils';
import { genesisBlock } from './constants/karaiConstants';
import { sql } from './db/sql';
import { printAscii } from './utils/printAscii';
import { setupEnv } from './utils/setupEnv';
import { sleep } from './utils/sleep';

printAscii();
setupEnv();
const { DAEMON_URI, API_PORT } = process.env;

async function main() {
  const app = express();
  app.use(helmet());
  app.use(bodyParser.json());
  app.use(cors());
  app.use(morgan('dev'));

  app.get('/pointers', async (req, res) => {
    const data = await sql('pointers').select();

    res.json({
      data,
      status: 'OK',
    });
  });

  app.listen(Number(API_PORT), () => {
    log.debug('express listening on port ' + API_PORT);
  });

  const optionsQuery = await sql('internal').select();
  if (optionsQuery.length === 0) {
    await sql('internal').insert({});
  }

  const [options] = optionsQuery;
  const { syncHeight } = options;

  let i = syncHeight || genesisBlock;
  while (true) {
    const infoRes = await ax.get(DAEMON_URI + '/info');
    if (infoRes) {
      log.debug('Network Block Height: ' + infoRes.data.height);
      const percentSync = ((i / infoRes.data.height) * 100).toFixed(2);
      log.debug('You are currently ' + percentSync + '% synced.');
      const getRawBlocksRes = await ax.post(DAEMON_URI + '/getrawblocks', {
        startHeight: i,
      });
      log.debug(
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
              log.debug(
                chalk.green.bold('New karai pointer found: ' + karaiPointer)
              );
              try {
                await sql('pointers').insert({ hash: karaiPointer });
              } catch (error) {
                if (error.errno && error.errno !== 19) {
                  throw new Error(error);
                }
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
      await sql('internal').update({ syncHeight: i });
    } else {
      throw new Error('/info did not respond.');
    }
    await sleep(5000);
  }
}

main();
