import bodyParser from 'body-parser';
import cors from 'cors';
import log from 'electron-log';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { db, monitor } from '..';

export class API {
  public app: Express = express();
  constructor(port: number) {
    this.init(port);
  }

  public init(port: number) {
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

    this.app.get('/search', async (req, res) => {
      if (!req.query.query) {
        res.json({
          data: 'A search query is required.',
          status: 'ERROR',
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

    this.app.listen(Number(port), () => {
      log.debug('API listening on port ' + port);
    });
  }
}
