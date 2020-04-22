import bodyParser from 'body-parser';
import chalk from 'chalk';
import cors from 'cors';
import log from 'electron-log';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { Database } from '../db/Database';

export class API {
  public app: Express = express();
  private db: Database;
  constructor(db: Database, port: number) {
    this.init(port);
    this.db = db;
  }

  public init(port: number) {
    this.app.use(helmet());
    this.app.use(bodyParser.json());
    this.app.use(cors());
    this.app.use(morgan('dev'));

    this.app.get('/pointers', async (req, res) => {
      const data = await this.db.sql('pointers').select();

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/pointer/:hex', async (req, res) => {
      const { hex } = req.params;

      const data = await this.db
        .sql('pointers')
        .select()
        .where({ hex });

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
