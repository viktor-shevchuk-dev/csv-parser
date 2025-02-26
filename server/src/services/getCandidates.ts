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

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

class RateLimiter {}

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

async function fetchRemainingPages(
  totalPages: number,
  pass: PassThrough,
  initialHeaders: Headers
) {
  let limitRemaining = Number(initialHeaders.get("x-rate-limit-remaining"));
  let limitResetSeconds = Number(initialHeaders.get("x-rate-limit-reset"));
  let rateLimit = Number(initialHeaders.get("x-rate-limit-limit"));

  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  let processedPages = 0;
  while (processedPages < pageNumbers.length) {
    const noWindow = limitRemaining < 1;
    if (noWindow) {
      const waitMs = limitResetSeconds * 1000;
      console.log(`Approaching limit. Waiting for ${waitMs}ms`);
      await delay(waitMs);
    }

    const concurrency = noWindow ? rateLimit : limitRemaining;
    console.log({ limitRemaining, concurrency, limitResetSeconds });
    const batch = pageNumbers.slice(
      processedPages,
      processedPages + concurrency
    );

    const urls = batch.map((page) =>
      fetchWithErrorHandling(getUrl(page, PAGE_SIZE), REQUEST_CONFIG)
    );

    const responses = await Promise.all(urls);

    const minRateLimit = responses.reduce(
      (acc, { headers }) => {
        const currLimitRemaining = Number(
          headers.get("x-rate-limit-remaining")
        );
        return currLimitRemaining > acc.limitRemaining
          ? acc
          : {
              limitRemaining: currLimitRemaining,
              limitResetSeconds: Number(headers.get("x-rate-limit-reset")),
            };
      },
      { limitRemaining: rateLimit, limitResetSeconds: 10 }
    );

    limitRemaining = minRateLimit.limitRemaining;
    limitResetSeconds = minRateLimit.limitResetSeconds;

    for (const { stream } of responses) {
      await pipelineAsync(stream, parser(), pass, { end: false });
    }

    processedPages += concurrency;
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
