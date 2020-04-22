import bodyParser from 'body-parser';
import chalk from 'chalk';
import cors from 'cors';
import log from 'electron-log';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sql } from '../db/sql';

export class API {
  public app: Express = express();

  constructor(port: number) {
    this.init(port);
  }

  public init(port: number) {
    this.app.use(helmet());
    this.app.use(bodyParser.json());
    this.app.use(cors());
    this.app.use(morgan('dev'));

    this.app.get('/pointers', async (req, res) => {
      const data = await sql('pointers').select();

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.get('/pointer/:hex', async (req, res) => {
      const { hex } = req.params;

      const data = await sql('pointers')
        .select()
        .where({ hex });

      res.json({
        data,
        status: 'OK',
      });
    });

    this.app.listen(Number(port), () => {
      log.debug(chalk.green.bold('API listening on port ' + port));
    });
  }
}
