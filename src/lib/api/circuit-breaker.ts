/**
 * Simple in-memory circuit breaker for external API calls.
 *
 * States:
 *   closed    → requests pass through normally
 *   open      → requests fail fast without hitting the API
 *   half-open → one probe request allowed; success resets, failure re-opens
 */

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: CircuitState = 'closed';

  constructor(
    private name: string,
    private threshold: number = 5,
    private cooldownMs: number = 60_000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.cooldownMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker [${this.name}] is OPEN — failing fast`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.warn(`[CircuitBreaker] ${this.name}: OPEN after ${this.failures} consecutive failures`);
    }
  }

  /** Expose state for monitoring / health checks */
  getState(): { state: CircuitState; failures: number } {
    return { state: this.state, failures: this.failures };
  }
}
