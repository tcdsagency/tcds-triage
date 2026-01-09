/**
 * Test single Donna customer lookup with debug
 */

const DONNA_BASE_URL = 'https://donna.gocrux.com';

async function main() {
  console.log('Testing simple Donna API call...\n');

  // First do OAuth login
  console.log('1. Starting OAuth flow...');
  let cookies: string[] = [];

  // Step 1: Start OAuth flow
  const startRes = await fetch(`${DONNA_BASE_URL}/api/auth/login`, { redirect: 'manual' });
  cookies.push(...extractCookies(startRes));
  const authorizeUrl = startRes.headers.get('location')!;
  console.log('   Got authorize URL');

  // Step 2: Get login form
  const authRes = await fetch(authorizeUrl, {
    redirect: 'manual',
    headers: { Cookie: cookies.join('; ') }
  });
  cookies = updateCookies(cookies, extractCookies(authRes));
  const loginUrl = authRes.headers.get('location')!;
  console.log('   Got login URL');

  // Step 3: Get login form HTML
  const formRes = await fetch(loginUrl, {
    redirect: 'manual',
    headers: { Cookie: cookies.join('; ') }
  });
  cookies = updateCookies(cookies, extractCookies(formRes));
  const html = await formRes.text();

  // Extract form details
  const actionMatch = html.match(/action="([^"]+)"/);
  let formAction = (actionMatch?.[1] || loginUrl).replace(/&amp;/g, '&');
  const xsrfMatch = html.match(/name="X-XSRF-TOKEN"[^>]+value="([^"]*)"/);
  const clientIdMatch = html.match(/name="client_id"[^>]+value="([^"]*)"/);
  console.log('   Got login form');

  // Step 4: Submit login
  const formData = new URLSearchParams({
    'X-XSRF-TOKEN': xsrfMatch?.[1] || '',
    'client_id': clientIdMatch?.[1] || '',
    'username': process.env.DONNA_USERNAME || '',
    'password': process.env.DONNA_PASSWORD || '',
  });

  console.log('2. Submitting login...');
  const submitRes = await fetch(formAction, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies.join('; ')
    },
    body: formData.toString(),
    redirect: 'manual'
  });
  cookies = updateCookies(cookies, extractCookies(submitRes));
  console.log('   Submit status:', submitRes.status);

  // Step 5: Follow redirects
  let redirectUrl = submitRes.headers.get('location')?.replace(/&amp;/g, '&');
  console.log('3. Following redirects...');
  for (let i = 0; i < 10 && redirectUrl; i++) {
    let fullUrl = redirectUrl.startsWith('/') ?
      (cookies.some(c => c.includes('GRAVITEE')) ? 'https://id-au-ui.gocrux.com' : DONNA_BASE_URL) + redirectUrl :
      redirectUrl;

    console.log(`   Redirect ${i+1}: ${fullUrl.substring(0, 80)}...`);
    const res = await fetch(fullUrl, {
      redirect: 'manual',
      headers: { Cookie: cookies.join('; ') }
    });

    const newCookies = extractCookies(res);
    if (newCookies.length) {
      console.log('   Got cookies:', newCookies.map(c => c.split('=')[0]));
    }
    cookies = updateCookies(cookies, newCookies);

    if (res.status !== 302 && res.status !== 301) {
      console.log(`   Final status: ${res.status}`);
      break;
    }
    redirectUrl = res.headers.get('location')?.replace(/&amp;/g, '&');
  }
  console.log('   Login complete, cookies:', cookies.length);
  console.log('   Cookies:', cookies);

  // Check if donna-prod cookie looks valid
  const donnaCookie = cookies.find(c => c.startsWith('donna-prod='));
  console.log('   Donna cookie:', donnaCookie?.substring(0, 80));

  // Step 6: Test API call
  console.log('\n3. Fetching customer data...');
  const apiStart = Date.now();
  const apiRes = await fetch(`${DONNA_BASE_URL}/api/cov/v1/data/TCDS-1918`, {
    redirect: 'manual',
    headers: {
      Cookie: cookies.join('; '),
      Accept: 'application/json'
    }
  });
  console.log('   Status:', apiRes.status);
  console.log('   Content-Type:', apiRes.headers.get('content-type'));
  console.log('   Location:', apiRes.headers.get('location'));
  console.log('   Time:', Date.now() - apiStart, 'ms');

  // Get any new cookies from this response
  const newCookies = extractCookies(apiRes);
  if (newCookies.length) console.log('   New cookies:', newCookies.map(c => c.split('=')[0]));

  if (apiRes.ok) {
    const data = await apiRes.json();
    console.log('   Success! Sentiment:', data.data?.Household?.['TCDS-1918']?.customerDetails?.['KPI SENTIMETER Value']);
  } else {
    console.log('   Body:', (await apiRes.text()).substring(0, 200));
  }

  console.log('\n✅ Done!');
}

function extractCookies(res: Response): string[] {
  const cookies: string[] = [];
  // @ts-ignore
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const val = c.split(';')[0].trim();
    if (val && !val.startsWith('Secure') && !val.startsWith('HttpOnly')) {
      cookies.push(val);
    }
  }
  return cookies;
}

function updateCookies(all: string[], newCookies: string[]): string[] {
  for (const c of newCookies) {
    const name = c.split('=')[0];
    all = all.filter(x => !x.startsWith(name + '='));
    all.push(c);
  }
  return all;
}

main().catch(console.error);
