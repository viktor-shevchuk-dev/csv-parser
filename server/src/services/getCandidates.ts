import { Response } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";

import {
  CsvTransformer,
  getUrl,
  Monitor,
  fetchWithErrorHandling,
  RateLimiter,
} from "../helpers";
import { CSV_HEADERS, PAGE_SIZE, REQUEST_CONFIG } from "../config";

const pipelineAsync = promisify(pipeline);

function createOutputPipeline(res: Response) {
  const pass = new PassThrough({ objectMode: true });
  pass.setMaxListeners(0);

  const jsonToCsv = new CsvTransformer();
  const monitor = new Monitor();

  pipelineAsync(
    pass,
    streamValues(),
    jsonToCsv,
    csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
    // monitor,
    // createBrotliCompress(),
    res
  ).catch((err) => {
    console.error("Pipeline failed:", err);
    pass.end();
    res.end();
    throw err;
  });

  return { pass, jsonToCsv };
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
