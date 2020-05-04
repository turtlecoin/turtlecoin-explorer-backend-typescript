import bodyParser from 'body-parser';
import cors from 'cors';
import log from 'electron-log';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { API_PORT, db, monitor, wss } from '..';
const offsetIncrement = 20;

export class API {
  public app: Express = express();
  constructor() {
    this.init();
  }

  public init() {
    this.app.use(helmet());
    this.app.use(bodyParser.json());
    this.app.use(cors());
    this.app.use(
      morgan('dev', {
        stream: {
          write: (str) => {
            log.debug(str.trim());
          },
        },
      })
    );

    this.app.get('/pointers/:hex', async (req, res) => {
      const { hex } = req.params;

      const data = await db
        .sql('pointers')
        .select('block', 'transaction', 'ascii', 'hex', 'timestamp')
        .where({ hex });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/pointers', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const { pointerHistory } = wss.getHistory();
      if (offset === 0 && pointerHistory.length >= 20) {
        res.json({
          data: pointerHistory,
          status: 'OK',
        });
        return;
      }

      const data = await db
        .sql('pointers')
        .select('block', 'transaction', 'ascii', 'hex', 'timestamp')
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(offsetIncrement);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/blocks/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('blocks')
        .select(
          'hash',
          'height',
          'timestamp',
          'size',
          'activate_parent_block_version',
          'major_version',
          'minor_version',
          'nonce'
        )
        .where({ hash });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/blocks', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const { blockHistory } = wss.getHistory();
      if (offset === 0 && blockHistory.length >= 20) {
        res.json({
          data: blockHistory,
          status: 'OK',
        });
        return;
      }

      const data = await db
        .sql('blocks')
        .select(
          'hash',
          'height',
          'timestamp',
          'size',
          'activate_parent_block_version',
          'major_version',
          'minor_version',
          'nonce'
        )
        .orderBy('height', 'desc')
        .offset(offset)
        .limit(offsetIncrement);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/transactions/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('transactions')
        .select(
          'hash',
          'block',
          'amount',
          'timestamp',
          'extra',
          'extra_data',
          'fee',
          'payment_id',
          'public_key',
          'size',
          'unlock_time'
        )
        .where({ hash });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/transactions', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const { txHistory } = wss.getHistory();
      if (offset === 0 && txHistory.length >= 20) {
        res.json({
          data: txHistory,
          status: 'OK',
        });
        return;
      }

      const data = await db
        .sql('transactions')
        .select(
          'hash',
          'block',
          'amount',
          'timestamp',
          'extra',
          'extra_data',
          'fee',
          'payment_id',
          'public_key',
          'size',
          'unlock_time'
        )
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(offsetIncrement);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/search', async (req, res) => {
      if (!req.query.query) {
        res.json({
          data: [],
          status: 'OK',
        });
      }

      const query = decodeURIComponent(req.query.query as string);

      if (Number.isInteger(Number(query))) {
        const blockQuery = await db
          .sql('blocks')
          .select()
          .where({ height: Number(query) });

        const blockData = [[], blockQuery, []];
        res.json({
          data: blockData,
          status: 'OK',
        });
      } else {
        const pointers = await db
          .sql('pointers')
          .select()
          .where({ hex: query });

        const blocks = await db
          .sql('blocks')
          .select()
          .where({ hash: query });

        const transactions = await db
          .sql('transactions')
          .select()
          .where({ hash: query })
          .orWhere({ payment_id: query });
        const data = [pointers, blocks, transactions];

        res.json({
          data,
          status: 'OK',
        });
      }
    });

    this.app.listen(Number(API_PORT!), () => {
      log.info('API listening on port ' + API_PORT);
    });
  }
}
