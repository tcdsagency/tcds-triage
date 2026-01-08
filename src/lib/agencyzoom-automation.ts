/**
 * AgencyZoom Automation Helper
 * ============================
 * Spawns Python/Selenium automation for AgencyZoom operations.
 * Used for SMS sending and other operations without public API support.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface AutomationCommand {
  action: 'login' | 'send_sms' | 'check_session' | 'get_cookies';
  phone_number?: string;
  message?: string;
  customer_id?: string;
  customer_type?: 'customer' | 'lead';
  force?: boolean;
}

export interface AutomationResult {
  success: boolean;
  error?: string;
  method?: string;
  logged_in?: boolean;
  cookies?: Array<{ name: string; value: string }>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const AUTOMATION_SCRIPT = path.join(process.cwd(), 'automation', 'agencyzoom_automation.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || 'python3';
const AUTOMATION_TIMEOUT_MS = 120_000; // 2 minutes

// =============================================================================
// AUTOMATION RUNNER
// =============================================================================

/**
 * Run an AgencyZoom automation command via Python/Selenium
 */
export async function runAutomation(command: AutomationCommand): Promise<AutomationResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Spawn Python process
    const proc: ChildProcess = spawn(PYTHON_EXECUTABLE, [AUTOMATION_SCRIPT, 'stdin'], {
      env: {
        ...process.env,
        HEADLESS: process.env.HEADLESS || 'true',
      },
    });

    // Set timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      resolve({
        success: false,
        error: `Automation timed out after ${AUTOMATION_TIMEOUT_MS / 1000}s`,
      });
    }, AUTOMATION_TIMEOUT_MS);

    // Collect stdout
    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle completion
    proc.on('close', (code: number | null) => {
      clearTimeout(timeout);

      if (timedOut) return;

      if (code !== 0) {
        console.error('[Automation] Process exited with code:', code);
        console.error('[Automation] stderr:', stderr);
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        console.error('[Automation] Failed to parse output:', stdout);
        resolve({
          success: false,
          error: `Invalid response: ${stdout}`,
        });
      }
    });

    // Handle process errors
    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error('[Automation] Process error:', err);
      resolve({
        success: false,
        error: err.message,
      });
    });

    // Send command via stdin
    proc.stdin?.write(JSON.stringify(command));
    proc.stdin?.end();
  });
}

// =============================================================================
// CONVENIENCE METHODS
// =============================================================================

/**
 * Send SMS via AgencyZoom browser automation
 */
export async function sendSmsViaAutomation(
  phoneNumber: string,
  message: string,
  options?: {
    customerId?: string;
    customerType?: 'customer' | 'lead';
  }
): Promise<AutomationResult> {
  return runAutomation({
    action: 'send_sms',
    phone_number: phoneNumber,
    message: message,
    customer_id: options?.customerId,
    customer_type: options?.customerType,
  });
}

/**
 * Check if AgencyZoom session is valid
 */
export async function checkSession(): Promise<AutomationResult> {
  return runAutomation({ action: 'check_session' });
}

/**
 * Login to AgencyZoom (pre-warm session)
 */
export async function loginToAgencyZoom(force: boolean = false): Promise<AutomationResult> {
  return runAutomation({ action: 'login', force });
}

/**
 * Get AgencyZoom session cookies for external use
 */
export async function getSessionCookies(): Promise<AutomationResult> {
  return runAutomation({ action: 'get_cookies' });
}
