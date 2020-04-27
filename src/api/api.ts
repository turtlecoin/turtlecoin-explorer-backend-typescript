import bodyParser from 'body-parser';
import cors from 'cors';
import log from 'electron-log';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { API_PORT, db, monitor } from '..';

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

    this.app.get('/status', async (req, res) => {
      const data = {
        networkHeight: monitor.getNetworkHeight(),
        syncHeight: monitor.getSyncHeight(),
        synced: monitor.synced,
      };
      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/pointer/:hex', async (req, res) => {
      const { hex } = req.params;

      const data = await db
        .sql('pointers')
        .select()
        .where({ hex });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/pointers', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const data = await db
        .sql('pointers')
        .select()
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(10);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/block/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('blocks')
        .select()
        .where({ hash });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/blocks', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const data = await db
        .sql('blocks')
        .select()
        .orderBy('height', 'desc')
        .offset(offset)
        .limit(10);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/transaction/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('transactions')
        .select()
        .where({ hash });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/transactions', async (req, res) => {
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const data = await db
        .sql('transactions')
        .select()
        .orderBy('rowid', 'desc')
        .offset(offset)
        .limit(10);

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/inputs/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('inputs')
        .select()
        .where({ transaction: hash });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/outputs/:hash', async (req, res) => {
      const { hash } = req.params;

      const data = await db
        .sql('outputs')
        .select()
        .where({ transaction: hash });

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

      const data = await db
        .sql('pointers')
        .select()
        .where({ id: query })
        .orWhere({ ascii: query })
        .orWhere({ hex: query })
        .orWhere({ block: query })
        .orWhere({ transaction: query })
        .orWhere({ timestamp: query });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.listen(Number(API_PORT!), () => {
      log.info('API listening on port ' + API_PORT);
    });
  }
}
