// Test raw RPR API responses

const TOKEN_SERVICE_URL = (process.env.TOKEN_SERVICE_URL || "http://75.37.55.209:8899")
  .replace(/\\n$/, '').replace(/\n$/, '').replace(/\/+$/, '').replace(/\/token$/, '');
const TOKEN_SERVICE_SECRET = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

async function getToken() {
  const response = await fetch(`${TOKEN_SERVICE_URL}/tokens/rpr`, {
    headers: { Authorization: `Bearer ${TOKEN_SERVICE_SECRET}` },
  });
  const result = await response.json();
  return result.token;
}

async function test() {
  const address = '6713 heather ridge cir pinson, al 35126';
  console.log('Testing raw RPR API for:', address);
  console.log('');

  const token = await getToken();
  console.log('Got token');

  // Step 1: Location search
  const searchUrl = new URL('https://webapi.narrpr.com/misc/location-suggestions');
  searchUrl.searchParams.set('propertyMode', '1');
  searchUrl.searchParams.set('userQuery', address);
  searchUrl.searchParams.set('category', '1');
  searchUrl.searchParams.set('getPlacesAreasAndProperties', 'true');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const searchData = await searchRes.json();

  console.log('=== LOCATION SEARCH ===');
  console.log(JSON.stringify(searchData, null, 2));

  // Get property ID from first result
  const propertyId = searchData?.sections?.[0]?.locations?.[0]?.propertyId;
  if (!propertyId) {
    console.log('No property ID found');
    return;
  }
  console.log('\nProperty ID:', propertyId);

  // Step 2: Common data
  const commonRes = await fetch(`https://webapi.narrpr.com/properties/${propertyId}/common`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const commonData = await commonRes.json();

  console.log('\n=== COMMON DATA ===');
  console.log(JSON.stringify(commonData, null, 2));

  // Step 3: Details data
  const detailsRes = await fetch(`https://webapi.narrpr.com/properties/${propertyId}/details`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const detailsData = await detailsRes.json();

  console.log('\n=== DETAILS DATA ===');
  console.log(JSON.stringify(detailsData, null, 2));
}

test().catch(console.error);
