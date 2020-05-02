import log from 'electron-log';
import { Block } from 'turtlecoin-utils';
// tslint:disable-next-line: no-var-requires
const sizeOf = require('object-sizeof');

export function checkSizeDifference(block: Block) {
  const blockHex = block.toString();
  const blockB64 = block.toBuffer().toString('base64');

  console.log('CHECKSIZE: The size of the hex block is ' + sizeOf(blockHex));
  console.log('CHECKSIZE: The size of the base64 block is ' + sizeOf(blockB64));
  if (sizeOf(blockHex) > sizeOf(blockB64)) {
    log.info(
      'CHECKSIZE: The hex block is bigger by ' +
        String(sizeOf(blockHex) - sizeOf(blockB64))
    );
  }
}
