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

async function processPaginatedRequests(
  totalPages: number,
  pass: PassThrough,
  concurrencyLimit: number = 5
) {
  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  let currentPageIndex = 0;
  while (currentPageIndex < pageNumbers.length) {
    const batch = pageNumbers.slice(
      currentPageIndex,
      currentPageIndex + concurrencyLimit
    );

    // const responses = await Promise.all(
    //   batch.map((page) =>
    //     fetchWithThrottling(REQUEST_CONFIG, getUrl(page, PAGE_SIZE))
    //   )
    // );

    const urls = batch.map((page) => getUrl(page, PAGE_SIZE));
    const responses = await fetchWithThrottling(REQUEST_CONFIG, ...urls);

    for (const { stream } of responses) {
      await pipelineAsync(stream, parser(), pass, { end: false });
    }

    currentPageIndex += concurrencyLimit;
  }
}

export const getCandidates = async (res: Response): Promise<void> => {
  const { pass, jsonToCsv } = createOutputPipeline(res);

  const [
    {
      stream: firstPageStream,
      headers: { rateLimit: concurrencyLimit },
    },
  ] = await fetchWithThrottling(REQUEST_CONFIG, getUrl(1, PAGE_SIZE));
  await pipelineAsync(firstPageStream, parser(), pass, { end: false });

  await processPaginatedRequests(jsonToCsv.totalPages, pass, concurrencyLimit);

  pass.end();
};
