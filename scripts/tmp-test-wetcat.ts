require('dotenv').config({ path: '.env.local' });

async function main() {
  const { rprClient } = await import('../src/lib/rpr');
  const { mmiClient } = await import('../src/lib/mmi');

  const address = '11 WET CAT RD, HAYDEN, AL 35079';

  console.log(`Testing: ${address}\n`);

  // RPR
  console.log('--- RPR ---');
  try {
    const rpr = await rprClient.lookupProperty(address);
    if (rpr) {
      console.log(`  Status: ${rpr.currentStatus}`);
      console.log(`  Owner: ${rpr.ownerName} | Occupied: ${rpr.ownerOccupied}`);
      console.log(`  Year Built: ${rpr.yearBuilt} | Sqft: ${rpr.sqft} | Beds: ${rpr.beds} | Baths: ${rpr.baths}`);
      console.log(`  Roof: ${rpr.roofType} (${rpr.roofMaterial || 'N/A'})`);
      console.log(`  Foundation: ${rpr.foundation} | Exterior: ${rpr.exteriorWalls}`);
      console.log(`  HVAC: ${rpr.hvac}`);
      console.log(`  Assessed: $${rpr.assessedValue?.toLocaleString()} | Estimated: $${rpr.estimatedValue?.toLocaleString()}`);
      console.log(`  Last Sale: ${rpr.lastSaleDate} @ $${rpr.lastSalePrice?.toLocaleString()}`);
      console.log(`  Flood Zone: ${rpr.floodZone || 'N/A'} | Risk: ${rpr.floodRisk || 'N/A'}`);
      if (rpr.listing) {
        console.log(`  LISTING: $${rpr.listing.price?.toLocaleString()} | ${rpr.listing.daysOnMarket} DOM | Agent: ${rpr.listing.agent} | Status: ${rpr.listing.status}`);
      }
      if (rpr.hasPool) console.log(`  Pool: ${rpr.pool}`);
      if (rpr.hasFireplace) console.log(`  Fireplaces: ${rpr.fireplaces}`);
      if (rpr.garageSpaces) console.log(`  Garage: ${rpr.garageSpaces} spaces (${rpr.garageType})`);
    } else {
      console.log('  No data returned');
    }
  } catch (err: any) {
    console.error(`  Error: ${err.message}`);
  }

  // MMI
  console.log('\n--- MMI ---');
  try {
    const mmi = await mmiClient.lookupByAddress(address);
    if (mmi.success && mmi.data) {
      console.log(`  Status: ${mmi.data.currentStatus}`);
      console.log(`  Last Sale: ${mmi.data.lastSaleDate} @ $${mmi.data.lastSalePrice?.toLocaleString()}`);
      if (mmi.data.listingHistory.length > 0) {
        console.log(`  Listing History (${mmi.data.listingHistory.length}):`);
        for (const l of mmi.data.listingHistory) {
          console.log(`    ${l.LISTING_DATE} | ${l.STATUS} | List: $${l.LIST_PRICE?.toLocaleString()} | Close: $${l.CLOSE_PRICE?.toLocaleString()} | Agent: ${l.LISTING_AGENT} | ${l.DAYS_ON_MARKET || '?'} DOM`);
        }
      }
      if (mmi.data.deedHistory.length > 0) {
        console.log(`  Deed History (${mmi.data.deedHistory.length}):`);
        for (const d of mmi.data.deedHistory) {
          console.log(`    ${d.DATE} | ${d.TRANSACTION_TYPE} | $${d.SALE_PRICE?.toLocaleString() || '0'} | Lender: ${d.LENDER} | Buyer: ${d.BUYER_NAME}`);
        }
      }
    } else {
      console.log(`  No data: ${mmi.error}`);
    }
  } catch (err: any) {
    console.error(`  Error: ${err.message}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
