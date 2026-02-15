import { rprClient } from '../src/lib/rpr';

async function test() {
  console.log('Testing RPR lookup for: 6713 heather ridge cir pinson, al 35126');
  console.log('');

  try {
    const result = await rprClient.lookupProperty('6713 heather ridge cir pinson, al 35126');

    if (result) {
      console.log('SUCCESS - Property found:');
      console.log('  Year Built:', result.yearBuilt);
      console.log('  Sqft:', result.sqft);
      console.log('  Stories:', result.stories);
      console.log('  Beds:', result.beds);
      console.log('  Baths:', result.baths);
      console.log('  Roof Type:', result.roofType);
      console.log('  Roof Material:', result.roofMaterial);
      console.log('  Construction:', result.constructionType);
      console.log('  Foundation:', result.foundation);
      console.log('  Exterior Walls:', result.exteriorWalls);
      console.log('  Heating:', result.heatingType);
      console.log('  Cooling:', result.coolingType);
      console.log('  Has Pool:', result.hasPool);
      console.log('  Garage:', result.garageType, result.garageSpaces);
    } else {
      console.log('FAILED - No result returned from RPR');
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
