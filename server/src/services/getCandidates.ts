import { Response } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";

import {
  CandidatesToCsvTransform,
  getUrl,
  Monitor,
  fetchWithErrorHandling,
} from "../helpers";
import {
  CSV_HEADERS,
  PAGE_SIZE,
  RATE_LIMIT_HEADERS,
  REQUEST_CONFIG,
} from "../config";

const pipelineAsync = promisify(pipeline);

function createOutputPipeline(res: Response) {
  const pass = new PassThrough({ objectMode: true });
  pass.setMaxListeners(0);

  const jsonToCsv = new CandidatesToCsvTransform();
  const monitor = new Monitor();

  pipelineAsync(
    pass,
    streamValues(),
    jsonToCsv,
    csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
    createBrotliCompress(),
    res
  );

  return { pass, jsonToCsv };
}

class RateLimiter {
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

async function fetchRemainingPages(
  totalPages: number,
  pass: PassThrough,
  initialHeaders: Headers
) {
  const rateLimiter = new RateLimiter(initialHeaders);

  const remainingPageNumbers = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2
  );

  let processedPages = 0;
  while (processedPages < remainingPageNumbers.length) {
    await rateLimiter.handleRateLimit();

    const batchEnd = processedPages + rateLimiter.remaining;
    const concurrencyPageNumbers = remainingPageNumbers.slice(
      processedPages,
      batchEnd
    );
    processedPages += rateLimiter.remaining;

    const fetchPromises = concurrencyPageNumbers.map((pageNumber) =>
      fetchWithErrorHandling(getUrl(pageNumber, PAGE_SIZE), REQUEST_CONFIG)
    );

    const responses = await Promise.all(fetchPromises);
    responses.forEach(({ headers }) => rateLimiter.updateFromHeaders(headers));

    for (const { stream } of responses) {
      await pipelineAsync(stream, parser(), pass, { end: false });
    }
  }
}

async function fetchFirstPage(pass: PassThrough) {
  const { stream: firstPageStream, headers } = await fetchWithErrorHandling(
    getUrl(1, PAGE_SIZE),
    REQUEST_CONFIG
  );

  await pipelineAsync(firstPageStream, parser(), pass, { end: false });

  return headers;
}

export const getCandidates = async (res: Response) => {
  const { pass, jsonToCsv } = createOutputPipeline(res);

  const firstPageHeaders = await fetchFirstPage(pass);

  await fetchRemainingPages(jsonToCsv.totalPages, pass, firstPageHeaders);

  pass.end();
};
