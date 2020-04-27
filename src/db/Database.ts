// tslint:disable: variable-name

import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import knex from 'knex';
import { Block, Transaction } from 'turtlecoin-utils';
import { wss } from '..';
import { prefix, suffix } from '../constants/karaiConstants';
import { hexToIp, hexToPort } from '../utils/hexHelpers';

export class Database extends EventEmitter {
  public ready: boolean;
  public sql: knex<any, unknown> = knex({
    client: 'sqlite3',
    connection: {
      filename: './db.sqlite',
    },
    useNullAsDefault: true,
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
    blockData: Block
  ): Promise<void> {
    const inputs = transaction.inputs;
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT INPUTS',
      chalk.yellow.bold('SUBMIT')
    );
    for (const input of inputs) {
      await this.sql('inputs').insert({
        string: input.toString(),
        transaction: transaction.hash,
        type: input.type,
      });
    }
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT INPUTS',
      chalk.green.bold('SUCCESS')
    );

    const outputs = transaction.outputs;
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT OUTPUTS',
      chalk.yellow.bold('SUBMIT')
    );
    for (const output of outputs) {
      await this.sql('inputs').insert({
        string: output.toString(),
        transaction: transaction.hash,
        type: output.type,
      });
    }
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT OUTPUTS',
      chalk.green.bold('SUCCESS')
    );

    if (this.isPointer(transaction.extra)) {
      this.storePointer(transaction, blockData);
    }

    const version = transaction.version;
    const amount = transaction.amount;
    const extra = transaction.extra;
    const extraData = transaction.extraData;
    const fee = transaction.fee;
    const hash = transaction.hash;
    const paymentID = transaction.paymentId;
    const publicKey = transaction.publicKey;
    const size = transaction.size;
    const unlockTime = transaction.unlockTime;
    const rawTx = transaction.toString();
    const block = blockData.hash;

    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT TRANSACTION',
      chalk.yellow.bold('SUBMIT')
    );

    const sanitizedTx = {
      amount,
      block,
      extra,
      extraData,
      fee,
      hash,
      paymentID,
      publicKey,
      rawTx,
      size,
      unlockTime,
      version,
    };

    await this.sql('transactions').insert(sanitizedTx);
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT TRANSACTION',
      chalk.green.bold('SUCCESS')
    );

    wss.broadcast('tx', sanitizedTx);
  }

  public async cleanup(blockCount: number = 1): Promise<void> {
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

      const tables = ['inputs', 'outputs', 'pointers'];
      for (const transaction of transactions) {
        for (const table of tables) {
          await this.sql(table)
            .where({ transaction })
            .del();
        }
      }
      i++;
    }
  }

  public async storePointer(transactionData: Transaction, blockData: Block) {
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
    const timestamp = blockData.timestamp.getTime();
    const transaction = transactionData.hash;

    const sanitizedPointer = {
      ascii,
      block,
      hex,
      timestamp,
      transaction,
    };

    await this.sql('pointers').insert(sanitizedPointer);
    log.debug(
      blockData.height,
      chalk.blue(transactionData.hash.slice(0, 10)),
      'INSERT POINTER',
      chalk.green.bold('SUCCESS')
    );

    wss.broadcast('pointer', sanitizedPointer);
  }

  public async storeBlock(block: Block): Promise<void> {
    log.debug(
      block.height,
      chalk.blue(block.hash.slice(0, 10)),
      'INSERT BLOCK',
      chalk.yellow.bold('SUBMIT')
    );
    const raw_block = block.toString();
    const hash = block.hash;
    const height = block.height;
    const size = block.size;
    const major_version = block.majorVersion;
    const minor_version = block.minorVersion;
    const timestamp = block.timestamp.getTime();
    const previous_hash = block.previousBlockHash;
    const nonce = block.nonce;
    const activate_parent_block_version = block.activateParentBlockVersion;

    await this.storeTransaction(block.minerTransaction, block);

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

    await this.sql('blocks').insert(sanitizedBlock);
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
      `SELECT name FROM sqlite_master
       WHERE type='table'
       ORDER BY name;`
    );
    const tableNames = tables.map((table: any) => table.name);

    if (!tableNames.includes('blocks')) {
      await this.sql.raw(
        `CREATE TABLE "blocks" (
          "raw_block" TEXT UNIQUE,
          "activate_parent_block_version" INTEGER,
          "hash" TEXT UNIQUE PRIMARY KEY,
          "height" INTEGER,
          "major_version" INTEGER,
          "minor_version" INTEGER,
          "nonce" TEXT,
          "previous_hash",
          "size" INTEGER,
          "timestamp" INTEGER
        );`
      );
    }

    if (!tableNames.includes('transactions')) {
      await this.sql.raw(
        `CREATE TABLE "transactions" (
          "hash" TEXT UNIQUE PRIMARY KEY,
          "block" TEXT,
          "amount" INTEGER,
          "version" INTEGER,
          "extra" BLOB,
          "extraData" BLOB,
          "fee" INTEGER,
          "paymentID" TEXT,
          "publicKey" TEXT,
          "size" INTEGER,
          "unlockTime" INTEGER,
          "rawTx" TEXT
        );`
      );
    }

    if (!tableNames.includes('inputs')) {
      await this.sql.raw(
        `CREATE TABLE "inputs" (
          "string" TEXT UNIQUE PRIMARY KEY,
          "transaction" TEXT,
          "type" INTEGER
        );`
      );
    }

    if (!tableNames.includes('outputs')) {
      await this.sql.raw(
        `CREATE TABLE "outputs" (
          "string" TEXT UNIQUE PRIMARY KEY,
          "transaction" TEXT,
          "type" INTEGER
        );`
      );
    }

    if (!tableNames.includes('pointers')) {
      await this.sql.raw(
        `CREATE TABLE "pointers" (
          "id"	INTEGER PRIMARY KEY AUTOINCREMENT,
          "ascii"	TEXT,
          "hex"	TEXT UNIQUE,
          "block"	TEXT,
          "transaction" TEXT,
          "timestamp" INTEGER
        );`
      );
    }

    this.ready = true;
    log.info('Database opened successfully');
  }
}
