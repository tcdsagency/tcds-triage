import * as fs from 'fs';
import * as path from 'path';

const file = path.resolve(__dirname, '../tmp-al3-extract/orion180-feb14/part1/YEE9T.YX67JQA.1(13).dat/YEE9T.YX67JQA.1.dat');
const content = fs.readFileSync(file, 'latin1');

// Split on any line endings
const lines = content.split(/\r?\n/);
console.log('Total lines:', lines.length);

let count = 0;
for (const line of lines) {
  const recType = line.substring(0, 4);
  if ((recType === '6CVH' || recType === '6CVA' || recType === '5CVG') && count < 10) {
    // Show positions 0-50 with non-printable chars replaced
    const display = line.substring(0, 55).replace(/[\x00-\x1f\x7f-\xff]/g, '?');
    console.log(`[${recType}] pos0-55: "${display}"`);
    console.log(`  pos30-45: "${line.substring(30, 45).replace(/[\x00-\x1f\x7f-\xff]/g, '?')}"`);
    count++;
  }
}
console.log('Found', count, 'coverage records');
