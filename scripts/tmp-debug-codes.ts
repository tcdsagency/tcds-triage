import * as fs from 'fs';
import * as path from 'path';
import { parseAL3File } from '../src/lib/al3/parser';
import { buildRenewalSnapshot } from '../src/lib/al3/snapshot-builder';

const BASE = path.resolve(__dirname, '../tmp-al3-extract/orion180-feb14');

function findFiles(dir: string): string[] {
  const r: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...findFiles(f));
    else if (/\.(dat|DAT)$/i.test(e.name) && !e.name.endsWith('.zip')) r.push(f);
  }
  return r;
}

const seen = new Set<string>();
let found = 0;

for (const file of findFiles(BASE)) {
  const stat = fs.statSync(file);
  const buf = Buffer.alloc(200);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, 200, 0);
  fs.closeSync(fd);
  const key = `${stat.size}:${buf.toString('hex')}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const content = fs.readFileSync(file, 'latin1');
  if (content.length < 50) continue;

  const txs = parseAL3File(content);
  for (const tx of txs) {
    // Check raw tx.coverages for date-like suffixes
    const dateCovs = tx.coverages.filter(c => /\d{6}$/.test(c.code));
    const vehDateCovs = tx.vehicles.flatMap(v => v.coverages.filter(c => /\d{6}$/.test(c.code)));

    if (dateCovs.length > 0 || vehDateCovs.length > 0) {
      found++;
      console.log(`\nFile: ${path.relative(BASE, file)}`);
      console.log(`Policy: ${tx.header.policyNumber} Carrier: ${tx.header.carrierName}`);
      if (dateCovs.length > 0) {
        console.log('Policy-level date-suffixed codes:');
        for (const c of dateCovs.slice(0, 5)) {
          console.log(`  raw code: "${c.code}" desc: "${c.description?.substring(0, 30)}"`);
        }
      }
      if (vehDateCovs.length > 0) {
        console.log('Vehicle-level date-suffixed codes:');
        for (const c of vehDateCovs.slice(0, 5)) {
          console.log(`  raw code: "${c.code}" desc: "${c.description?.substring(0, 30)}"`);
        }
      }

      // Also build snapshot to see the normalized type
      const snap = buildRenewalSnapshot(tx);
      const snapDateCovs = snap.coverages.filter(c => /_\d{6}$/.test(c.type));
      if (snapDateCovs.length > 0) {
        console.log('Snapshot date-suffixed types:');
        for (const c of snapDateCovs.slice(0, 5)) {
          console.log(`  type: "${c.type}" code: "${c.code}"`);
        }
      }

      if (found >= 5) break;
    }
  }
  if (found >= 5) break;
}

if (found === 0) {
  console.log('No date-suffixed raw codes found. Checking snapshot-level...');
  const seen2 = new Set<string>();
  let found2 = 0;
  for (const file of findFiles(BASE)) {
    const stat = fs.statSync(file);
    const buf = Buffer.alloc(200);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, 200, 0);
    fs.closeSync(fd);
    const key = `${stat.size}:${buf.toString('hex')}`;
    if (seen2.has(key)) continue;
    seen2.add(key);

    const content = fs.readFileSync(file, 'latin1');
    if (content.length < 50) continue;

    const txs = parseAL3File(content);
    for (const tx of txs) {
      const snap = buildRenewalSnapshot(tx);
      const snapDateCovs = snap.coverages.filter(c => /_\d{6}$/.test(c.type));
      if (snapDateCovs.length > 0) {
        found2++;
        console.log(`\nFile: ${path.relative(BASE, file)}`);
        console.log(`Policy: ${tx.header.policyNumber} Carrier: ${tx.header.carrierName}`);
        for (const c of snapDateCovs.slice(0, 5)) {
          console.log(`  type: "${c.type}" code: "${c.code}" limit: ${c.limitAmount} prem: ${c.premium}`);
        }
        // Show the raw coverage that generated this
        for (const sc of snapDateCovs.slice(0, 2)) {
          const rawMatch = tx.coverages.find(rc => {
            const norm = rc.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_').toLowerCase();
            return sc.type === norm;
          });
          if (rawMatch) {
            console.log(`  -> raw code for "${sc.type}": "${rawMatch.code}"`);
          }
        }
        if (found2 >= 5) break;
      }
    }
    if (found2 >= 5) break;
  }
}

console.log(`\nDone. Found ${found} policies with date-suffixed raw codes.`);
