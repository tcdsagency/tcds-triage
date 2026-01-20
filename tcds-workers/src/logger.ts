/**
 * Logger Module
 *
 * Winston-based logging with JSON format for Railway and
 * colorized format for local development.
 *
 * Supports both:
 * - logger.info('message')
 * - logger.info({ key: value }, 'message')
 */

import winston from 'winston';

// Get config values directly to avoid circular dependency
const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * JSON format for production (Railway ingests JSON logs)
 */
const formatForRailway = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Colorized format for local development
 */
const formatForDev = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length && Object.keys(meta).some(k => k !== 'service')
      ? ' ' + JSON.stringify(meta)
      : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

/**
 * Base Winston logger instance
 */
const winstonLogger = winston.createLogger({
  level: logLevel,
  format: nodeEnv === 'production' ? formatForRailway : formatForDev,
  defaultMeta: { service: 'tcds-workers' },
  transports: [new winston.transports.Console()],
});

/**
 * Logger wrapper that supports Pino-style logging:
 * - logger.info('message')
 * - logger.info({ key: value }, 'message')
 */
type LogFn = (metaOrMessage: string | Record<string, unknown>, message?: string) => void;

function createLogFn(level: string): LogFn {
  return (metaOrMessage: string | Record<string, unknown>, message?: string) => {
    if (typeof metaOrMessage === 'string') {
      winstonLogger.log(level, metaOrMessage);
    } else if (message) {
      winstonLogger.log(level, message, metaOrMessage);
    } else {
      winstonLogger.log(level, JSON.stringify(metaOrMessage));
    }
  };
}

export const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  child: (context: Record<string, unknown>) => {
    const childLogger = winstonLogger.child(context);
    return {
      info: (metaOrMessage: string | Record<string, unknown>, message?: string) => {
        if (typeof metaOrMessage === 'string') {
          childLogger.info(metaOrMessage);
        } else if (message) {
          childLogger.info(message, metaOrMessage);
        } else {
          childLogger.info(JSON.stringify(metaOrMessage));
        }
      },
      warn: (metaOrMessage: string | Record<string, unknown>, message?: string) => {
        if (typeof metaOrMessage === 'string') {
          childLogger.warn(metaOrMessage);
        } else if (message) {
          childLogger.warn(message, metaOrMessage);
        } else {
          childLogger.warn(JSON.stringify(metaOrMessage));
        }
      },
      error: (metaOrMessage: string | Record<string, unknown>, message?: string) => {
        if (typeof metaOrMessage === 'string') {
          childLogger.error(metaOrMessage);
        } else if (message) {
          childLogger.error(message, metaOrMessage);
        } else {
          childLogger.error(JSON.stringify(metaOrMessage));
        }
      },
      debug: (metaOrMessage: string | Record<string, unknown>, message?: string) => {
        if (typeof metaOrMessage === 'string') {
          childLogger.debug(metaOrMessage);
        } else if (message) {
          childLogger.debug(message, metaOrMessage);
        } else {
          childLogger.debug(JSON.stringify(metaOrMessage));
        }
      },
    };
  },
};
