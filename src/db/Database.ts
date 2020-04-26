// tslint:disable: variable-name

import chalk from 'chalk';
import log from 'electron-log';
import { EventEmitter } from 'events';
import knex from 'knex';
import { Block, Transaction } from 'turtlecoin-utils';

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

    // const signatures = transaction.signatures;
    // log.debug('Inserting signatures for ' + transaction.hash);
    // for (const signatureList of signatures) {
    //   for (const signature of signatureList) {
    //     await this.sql('signatures').insert({
    //       string: signature,
    //       transaction: transaction.hash,
    //     });
    //   }
    // }
    // log.debug('Inserting signatures success ' + transaction.hash);

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
    await this.sql('transactions').insert({
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
    });
    log.debug(
      blockData.height,
      chalk.blue(transaction.hash.slice(0, 10)),
      'INSERT TRANSACTION',
      chalk.green.bold('SUCCESS')
    );
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

    await this.sql('blocks').insert({
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
    });
    log.debug(
      block.height,
      chalk.blue(block.hash.slice(0, 10)),
      'INSERT BLOCK',
      chalk.green.bold('SUCCESS')
    );
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
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "string" TEXT,
          "transaction" TEXT,
          "type" INTEGER
        );`
      );
    }

    if (!tableNames.includes('outputs')) {
      await this.sql.raw(
        `CREATE TABLE "outputs" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "string" TEXT,
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
    log.debug('Database opened successfully');
  }
}
