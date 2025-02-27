import { RATE_LIMIT_HEADERS } from "../config";

export class RateLimiter {
  public remaining: number;
  private resetSeconds: number;
  private readonly maxConcurrency: number;

  constructor(initialHeaders: Headers) {
    this.remaining = Number(initialHeaders.get(RATE_LIMIT_HEADERS.REMAINING));
    this.resetSeconds = Number(
      initialHeaders.get(RATE_LIMIT_HEADERS.RESET_SECONDS)
    );
    this.maxConcurrency = Number(initialHeaders.get(RATE_LIMIT_HEADERS.LIMIT));
  }

  async handleRateLimit() {
    const isDelay = this.remaining < 1;
    if (!isDelay) return;

    const delayMs = this.resetSeconds * 1000;
    console.log(`Approaching limit. Waiting for ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    this.remaining = this.maxConcurrency;
  }

  updateFromHeaders(headers: Headers) {
    const newRemaining = Number(headers.get(RATE_LIMIT_HEADERS.REMAINING));
    const isNewLimitSmaller = this.remaining > newRemaining;

    if (isNewLimitSmaller) {
      this.remaining = newRemaining;

      const newResetSeconds = Number(
        headers.get(RATE_LIMIT_HEADERS.RESET_SECONDS)
      );
      this.resetSeconds = newResetSeconds;
    }
  }
}
