// Quick test of Twilio credentials
async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    process.exit(1);
  }

  console.log(`Testing Twilio connection...`);
  console.log(`  Account SID: ${accountSid}`);
  console.log(`  Auth Token: ${authToken.slice(0, 4)}...${authToken.slice(-4)}`);

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`\nConnection successful!`);
    console.log(`  Account Name: ${data.friendly_name}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Type: ${data.type}`);
  } else {
    const text = await res.text();
    console.error(`\nConnection FAILED: ${res.status} ${res.statusText}`);
    console.error(`  Response: ${text}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
