/**
 * Notifications Worker
 *
 * Handles sending emails, SMS, and other notifications.
 *
 * Job Types:
 * - email: Send an email notification
 * - sms: Send an SMS notification
 * - payment_reminder: Send payment reminder batch
 * - policy_expiration: Send policy expiration notices batch
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../redis';
import { config } from '../config';
import { logger } from '../logger';
import { NotificationJobData } from '../queues';

/**
 * Create and return the notifications worker
 */
export function createNotificationsWorker(): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { type, recipientId, templateId, data } = job.data;

      logger.info({
        event: 'notification_start',
        jobId: job.id,
        type,
        recipientId,
        templateId,
      });

      const startTime = Date.now();
      let sentCount = 0;
      let errorCount = 0;

      try {
        switch (type) {
          case 'email':
            await sendEmail(recipientId!, templateId!, data);
            sentCount = 1;
            break;

          case 'sms':
            await sendSms(recipientId!, templateId!, data);
            sentCount = 1;
            break;

          case 'payment_reminder':
            const paymentResults = await sendPaymentReminders(job);
            sentCount = paymentResults.sent;
            errorCount = paymentResults.errors;
            break;

          case 'policy_expiration':
            const expirationResults = await sendExpirationNotices(job);
            sentCount = expirationResults.sent;
            errorCount = expirationResults.errors;
            break;

          default:
            throw new Error(`Unknown notification type: ${type}`);
        }

        const duration = Date.now() - startTime;

        logger.info({
          event: 'notification_complete',
          jobId: job.id,
          type,
          sentCount,
          errorCount,
          durationMs: duration,
        });

        return {
          success: true,
          type,
          sentCount,
          errorCount,
          durationMs: duration,
        };
      } catch (err) {
        logger.error({
          event: 'notification_error',
          jobId: job.id,
          type,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 30,
        duration: 60000, // Max 30 per minute
      },
    }
  );
}

// =============================================================================
// NOTIFICATION FUNCTIONS
// =============================================================================

async function sendEmail(
  recipientId: string,
  templateId: string,
  data?: Record<string, unknown>
): Promise<void> {
  logger.debug({ recipientId, templateId }, 'Sending email');

  const response = await fetch(`${config.app.url}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify({
      type: 'email',
      recipientId,
      templateId,
      data,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${response.status} ${errorText}`);
  }
}

async function sendSms(
  recipientId: string,
  templateId: string,
  data?: Record<string, unknown>
): Promise<void> {
  logger.debug({ recipientId, templateId }, 'Sending SMS');

  const response = await fetch(`${config.app.url}/api/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.app.internalKey}`,
    },
    body: JSON.stringify({
      recipientId,
      templateId,
      data,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SMS send failed: ${response.status} ${errorText}`);
  }
}

async function sendPaymentReminders(
  job: Job<NotificationJobData>
): Promise<{ sent: number; errors: number }> {
  logger.info('Processing payment reminders');

  // Fetch customers with upcoming payments
  const response = await fetch(
    `${config.app.url}/api/mortgagee-payments/pending?daysAhead=7`,
    {
      headers: {
        Authorization: `Bearer ${config.app.internalKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch pending payments: ${response.status}`);
  }

  interface Payment {
    customerId: string;
    amount: number;
    dueDate: string;
    policyNumber: string;
  }
  const data = await response.json() as { payments?: Payment[] };
  const { payments } = data;

  if (!payments || payments.length === 0) {
    logger.info('No pending payments to remind');
    return { sent: 0, errors: 0 };
  }

  logger.info({ count: payments.length }, 'Sending payment reminders');

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];

    try {
      await sendEmail(payment.customerId, 'payment-reminder', {
        amount: payment.amount,
        dueDate: payment.dueDate,
        policyNumber: payment.policyNumber,
      });
      sent++;
    } catch (err) {
      logger.warn(
        { customerId: payment.customerId, error: err },
        'Failed to send payment reminder'
      );
      errors++;
    }

    // Update progress
    await job.updateProgress(Math.round(((i + 1) / payments.length) * 100));

    // Rate limit
    if (i < payments.length - 1) {
      await sleep(500);
    }
  }

  return { sent, errors };
}

async function sendExpirationNotices(
  job: Job<NotificationJobData>
): Promise<{ sent: number; errors: number }> {
  logger.info('Processing expiration notices');

  // Fetch policies expiring soon
  const response = await fetch(
    `${config.app.url}/api/policy/search?expiringWithinDays=30&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${config.app.internalKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch expiring policies: ${response.status}`);
  }

  interface Policy {
    id: string;
    customerId: string;
    policyNumber: string;
    lineOfBusiness: string;
    expirationDate: string;
    carrier: string;
    expirationNoticeSent?: boolean;
  }
  const policiesData = await response.json() as { policies?: Policy[] };
  const { policies } = policiesData;

  if (!policies || policies.length === 0) {
    logger.info('No policies expiring soon');
    return { sent: 0, errors: 0 };
  }

  logger.info({ count: policies.length }, 'Sending expiration notices');

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < policies.length; i++) {
    const policy = policies[i];

    // Skip if notice already sent
    if (policy.expirationNoticeSent) {
      continue;
    }

    try {
      await sendEmail(policy.customerId, 'policy-expiration', {
        policyNumber: policy.policyNumber,
        lineOfBusiness: policy.lineOfBusiness,
        expirationDate: policy.expirationDate,
        carrier: policy.carrier,
      });

      // Mark notice as sent
      await fetch(`${config.app.url}/api/policy/${policy.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.app.internalKey}`,
        },
        body: JSON.stringify({
          expirationNoticeSent: true,
          expirationNoticeSentAt: new Date().toISOString(),
        }),
      });

      sent++;
    } catch (err) {
      logger.warn(
        { policyId: policy.id, error: err },
        'Failed to send expiration notice'
      );
      errors++;
    }

    // Update progress
    await job.updateProgress(Math.round(((i + 1) / policies.length) * 100));

    // Rate limit
    if (i < policies.length - 1) {
      await sleep(500);
    }
  }

  return { sent, errors };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
