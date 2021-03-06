// tslint:disable: variable-name

import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import knex from 'knex';
import { Block, Transaction } from 'turtlecoin-utils';
import {
  db,
  rewindBlocks,
  SQL_DB_NAME,
  SQL_HOST,
  SQL_PASSWORD,
  SQL_PORT,
  SQL_USER,
  wss,
} from '..';
import { prefix, suffix } from '../constants/karaiConstants';
import { hexToIp, hexToPort } from '../utils/hexHelpers';

export class Database extends EventEmitter {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'mysql',
    version: '8.0',
    connection: {
      host: SQL_HOST,
      user: SQL_USER,
      password: SQL_PASSWORD,
      database: SQL_DB_NAME,
      port: Number(SQL_PORT),
    },
  });

  constructor() {
    super();
    this.ready = false;
    this.init();
    this.reset = this.reset.bind(this);
  }

  public async reset(): Promise<void> {
    const commands = [
      'DELETE FROM pointers;',
      'DELETE FROM sqlite_sequence WHERE name="pointers";',
      'DELETE FROM internal;',
    ];

    for (const command of commands) {
      await this.sql.raw(command);
    }
  }

  public async storeTransaction(
    transaction: Transaction,
    blockData: Block,
    trx: knex.Transaction<any, any>,
    isCoinbase: boolean = false
  ): Promise<void> {
    if (this.isPointer(transaction.extra)) {
      this.storePointer(transaction, blockData, trx);
    }

    const version = transaction.version;
    const amount = transaction.amount.toString();
    const extra = transaction.extra;
    const extra_data = transaction.extraData;
    const fee = transaction.fee;
    const hash = transaction.hash;
    const payment_id = transaction.paymentId;
    const public_key = transaction.publicKey;
    const size = transaction.size;
    const unlock_time = transaction.unlockTime.toString();
    const raw_tx = transaction.toBuffer();
    const block = blockData.hash;
    const timestamp = blockData.timestamp.getTime() / 1000;

    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      `INSERT ${isCoinbase ? 'COINBASE' : 'TRANSACTION'}`,
      chalk.yellow.bold('SUBMIT')
    );

    const sanitizedTx = {
      amount,
      block,
      extra,
      extra_data,
      fee,
      hash,
      payment_id,
      public_key,
      raw_tx,
      size,
      unlock_time,
      version,
      timestamp,
    };

    await this.sql('transactions')
      .insert(sanitizedTx)
      .transacting(trx);

    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      `INSERT ${isCoinbase ? 'COINBASE' : 'TRANSACTION'}`,
      chalk.green.bold('SUCCESS')
    );

    wss.broadcast('tx', sanitizedTx);
  }

  public async cleanup(blockCount: number = 1): Promise<void> {
    log.debug(`Rewinding ${blockCount} blocks...`);
    let i = 0;
    while (i < blockCount) {
      const blockQuery = await this.sql('blocks')
        .select('hash')
        .orderBy('height', 'desc')
        .limit(1);
      if (blockQuery.length === 0) {
        return;
      }

      const topBlock = blockQuery.map((row) => row.hash)[0];

      log.debug('Deleting block ' + topBlock);

      await this.sql('blocks')
        .where({ hash: topBlock })
        .del();

      const transactionQuery = await this.sql('transactions')
        .select('hash')
        .where({ block: topBlock });

      let transactions = [];
      if (transactionQuery.length > 0) {
        transactions = transactionQuery.map((row) => row.hash);
      }

      await this.sql('transactions')
        .where({ block: topBlock })
        .del();

      const tables = ['pointers'];
      for (const transaction of transactions) {
        for (const table of tables) {
          await this.sql(table)
            .where({ transaction })
            .del();
        }
      }

      log.debug('Block delete success.');
      i++;
    }
    log.debug('Block rewind success.');
  }

  public async storePointer(
    transactionData: Transaction,
    blockData: Block,
    trx: knex.Transaction<any, any>
  ) {
    log.debug(
      blockData.height,
      chalk.blue(transactionData.hash.slice(0, 10)),
      'INSERT POINTER',
      chalk.yellow.bold('SUBMIT')
    );
    const peer = transactionData.extra
      .toString('hex')
      .split(prefix)[1]
      .substring(0, 12);
    const hex = prefix + peer + suffix;
    const peerIP = hexToIp(peer.substring(0, 8));
    const port = hexToPort(peer.substring(8, 12));
    const ascii = `ktx://${peerIP}:${port.toString()}`;
    const block = blockData.hash;
    const timestamp = blockData.timestamp.getTime() / 1000;
    const transaction = transactionData.hash;
    const raw_pointer = transactionData.extra;

    const sanitizedPointer = {
      ascii,
      block,
      hex,
      timestamp,
      transaction,
      raw_pointer,
    };

    await this.sql('pointers')
      .insert(sanitizedPointer)
      .transacting(trx);
    log.debug(
      blockData.height,
      chalk.blue(transactionData.hash.slice(0, 10)),
      'INSERT POINTER',
      chalk.green.bold('SUCCESS')
    );

    wss.broadcast('pointer', sanitizedPointer);
  }

  public async storeBlock(
    block: Block,
    trx: knex.Transaction<any, any>
  ): Promise<void> {
    log.debug(
      block.height,
      chalk.blue(block.hash.slice(0, 10)),
      'INSERT BLOCK',
      chalk.yellow.bold('SUBMIT')
    );
    const raw_block = block.toBuffer();
    const hash = block.hash;
    const height = block.height;
    const size = block.size;
    const major_version = block.majorVersion;
    const minor_version = block.minorVersion;
    const timestamp = block.timestamp.getTime() / 1000;
    const previous_hash = block.previousBlockHash;
    const nonce = block.nonce;
    const activate_parent_block_version = block.activateParentBlockVersion;

    await this.storeTransaction(block.minerTransaction, block, trx, true);

    const sanitizedBlock = {
      activate_parent_block_version,
      hash,
      height,
      major_version,
      minor_version,
      nonce,
      previous_hash,
      raw_block,
      size,
      timestamp,
    };

    await this.sql('blocks')
      .insert(sanitizedBlock)
      .transacting(trx);
    log.debug(
      block.height,
      chalk.blue(block.hash.slice(0, 10)),
      'INSERT BLOCK',
      chalk.green.bold('SUCCESS')
    );

    wss.broadcast('block', sanitizedBlock);
  }

  private isPointer(txExtra: Buffer) {
    return txExtra.toString('hex').includes(prefix);
  }

  private async init(): Promise<void> {
    const tables = await this.sql.raw(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = "explorer"'
    );

    // wtf mysql
    const tableNames = tables[0].map((row: any) =>
      row.table_name ? row.table_name : row.TABLE_NAME
    );

    if (!tableNames.includes('blocks')) {
      log.info('Creating blocks table...');
      await this.sql.schema.createTable('blocks', (table) => {
        table
          .string('hash')
          .primary()
          .unique()
          .index();
        table
          .integer('height')
          .unique()
          .index();
        table.integer('timestamp');
        table.integer('size');
        table.integer('activate_parent_block_version');
        table.integer('major_version');
        table.integer('minor_version');
        table.string('nonce');
        table.string('previous_hash');
        table.specificType('raw_block', 'mediumblob');
      });
    }

    if (!tableNames.includes('transactions')) {
      log.info('Creating transaction table...');
      await this.sql.schema.createTable('transactions', (table) => {
        table.increments('id');
        table
          .string('hash')
          .unique()
          .index();
        table.string('block').index();
        table.string('amount');
        table.integer('timestamp');
        table.integer('version');
        table.specificType('extra', 'mediumblob');
        table.specificType('extra_data', 'mediumblob');
        table.integer('fee');
        table.string('payment_id').index();
        table.string('public_key');
        table.integer('size');
        table.string('unlock_time');
        table.specificType('raw_tx', 'mediumblob');
      });
    }

    if (!tableNames.includes('pointers')) {
      log.info('Creating pointer table');
      await this.sql.schema.createTable('pointers', (table) => {
        table.increments('id');
        table.string('block').index();
        table.string('transaction').index();
        table.string('ascii');
        table.string('hex').index();
        table.integer('timestamp');
        table.specificType('raw_pointer', 'mediumblob');
      });
    }

    if (rewindBlocks) {
      await db.cleanup(rewindBlocks);
    }

    log.info('Database is ready!');
    this.ready = true;
  }
}
