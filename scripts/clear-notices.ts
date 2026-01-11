import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/db';
import { policyNotices, policyNoticeWebhookDeliveries } from '../src/db/schema';

async function main() {
  console.log('Clearing policy notice webhook deliveries...');
  await db.delete(policyNoticeWebhookDeliveries);

  console.log('Clearing policy notices...');
  await db.delete(policyNotices);

  console.log('Done! All policy notices cleared.');
  process.exit(0);
}

main().catch(console.error);
