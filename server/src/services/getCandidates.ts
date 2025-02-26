import { Response } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";

import { CandidatesToCsvTransform, getUrl, Monitor } from "../helpers";
import { CSV_HEADERS, PAGE_SIZE, REQUEST_CONFIG } from "../config";
import { fetchWithErrorHandling } from "../helpers/fetchWithErrorHandling";

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
  public limitRemaining: number;
  private limitResetSeconds: number;
  private readonly maxConcurrency: number;

  constructor(initialHeaders: Headers) {
    this.limitRemaining = Number(initialHeaders.get("x-rate-limit-remaining"));
    this.limitResetSeconds = Number(initialHeaders.get("x-rate-limit-reset"));
    this.maxConcurrency = Number(initialHeaders.get("x-rate-limit-limit"));
  }

  async handleRateLimit() {
    const isDelay = this.limitRemaining < 1;
    if (!isDelay) return;

    const delayMs = this.limitResetSeconds * 1000;
    console.log(`Approaching limit. Waiting for ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    this.limitRemaining = this.maxConcurrency;
  }

  updateFromHeaders(headers: Headers) {
    const newLimitRemaining = Number(headers.get("x-rate-limit-remaining"));
    const isNewLimitSmaller = this.limitRemaining > newLimitRemaining;

    if (isNewLimitSmaller) {
      this.limitRemaining = newLimitRemaining;

      const newLimitResetSeconds = Number(headers.get("x-rate-limit-reset"));
      this.limitResetSeconds = newLimitResetSeconds;
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

    const batchEnd = processedPages + rateLimiter.limitRemaining;
    const concurrencyPageNumbers = remainingPageNumbers.slice(
      processedPages,
      batchEnd
    );

    const urls = concurrencyPageNumbers.map((pageNumber) =>
      fetchWithErrorHandling(getUrl(pageNumber, PAGE_SIZE), REQUEST_CONFIG)
    );

    const responses = await Promise.all(urls);
    responses.forEach(({ headers }) => rateLimiter.updateFromHeaders(headers));

    for (const { stream } of responses) {
      await pipelineAsync(stream, parser(), pass, { end: false });
    }

    processedPages += rateLimiter.limitRemaining;
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
