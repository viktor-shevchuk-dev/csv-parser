import { Response, NextFunction } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";

import {
  CandidatesToCsvTransform,
  fetchWithThrottling,
  getUrl,
  Monitor,
} from "../helpers";
import { CSV_HEADERS, PAGE_SIZE, REQUEST_CONFIG } from "../config";

const pipelineAsync = promisify(pipeline);

function createOutputPipeline(res: Response) {
  const pass = new PassThrough({ objectMode: true });
  pass.setMaxListeners(0);
  pass.on("error", (err) => {
    console.log({ err }, "pass error");
  });

  const jsonToCsv = new CandidatesToCsvTransform();
  const monitor = new Monitor();

  pipelineAsync(
    pass,
    streamValues(),
    jsonToCsv,
    csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
    createBrotliCompress(),
    res
  ).catch((error) => {
    console.error("Pipeline error:", error);
    pass.destroy(error);
    throw error;
  });

  return { pass, jsonToCsv };
}

async function processResponse(
  responseStream: NodeJS.ReadableStream,
  pass: PassThrough
) {
  try {
    await pipelineAsync(responseStream, parser(), pass, { end: false });
  } catch (error) {
    console.error("Response processing error:", error);
    pass.destroy(error as Error);
    throw error;
  }
}

async function processPaginatedRequests(
  totalPages: number,
  concurrencyLimit: number,
  pass: PassThrough
) {
  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  let i = 0;
  while (i < pageNumbers.length) {
    const batch = pageNumbers.slice(i, i + concurrencyLimit);

    const responses = await Promise.all(
      batch.map((page) =>
        fetchWithThrottling(getUrl(page, PAGE_SIZE), REQUEST_CONFIG)
      )
    );

    for (const { stream } of responses) {
      await processResponse(stream, pass);
    }

    i += concurrencyLimit;
  }
}

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pass, jsonToCsv } = createOutputPipeline(res);

    const {
      stream: firstPageStream,
      headers: { rateLimit: concurrencyLimit },
    } = await fetchWithThrottling(getUrl(1, PAGE_SIZE), REQUEST_CONFIG);
    await processResponse(firstPageStream, pass);

    await processPaginatedRequests(
      jsonToCsv.totalPages,
      concurrencyLimit,
      pass
    );

    pass.end();
  } catch (error) {
    next(error);
  }
};
