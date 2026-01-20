/**
 * Configuration Module
 *
 * Centralizes all environment configuration with validation.
 */

export const config = {
  redis: {
    url: process.env.REDIS_URL!,
  },
  app: {
    url: process.env.TCDS_APP_URL!,
    internalKey: process.env.INTERNAL_API_KEY!,
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },
  voiptools: {
    server: process.env.VOIPTOOLS_SQL_SERVER!,
    database: process.env.VOIPTOOLS_SQL_DATABASE!,
    user: process.env.VOIPTOOLS_SQL_USER!,
    password: process.env.VOIPTOOLS_SQL_PASSWORD!,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  agencyzoom: {
    apiKey: process.env.AGENCYZOOM_API_KEY!,
    apiUrl: process.env.AGENCYZOOM_API_URL || 'https://api.agencyzoom.com',
  },
  port: parseInt(process.env.PORT || '3001', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;

/**
 * Validate all required environment variables are present.
 * Called on startup to fail fast if misconfigured.
 */
export function validateConfig(): void {
  const required = [
    'REDIS_URL',
    'TCDS_APP_URL',
    'INTERNAL_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'VOIPTOOLS_SQL_SERVER',
    'VOIPTOOLS_SQL_DATABASE',
    'VOIPTOOLS_SQL_USER',
    'VOIPTOOLS_SQL_PASSWORD',
    'ANTHROPIC_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
