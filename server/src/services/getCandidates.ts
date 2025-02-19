import { Response, NextFunction } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";

import {
  CandidatesToCsvTransform,
  delay,
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
  headers: Headers
) {
  let limitRemaining = Number(headers.get("x-rate-limit-remaining"));
  let limitResetSeconds = Number(headers.get("x-rate-limit-reset"));
  let rateLimit = Number(headers.get("x-rate-limit-limit"));

  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  let currentPageIndex = 0;
  while (currentPageIndex < pageNumbers.length) {
    if (limitRemaining < 1) {
      const waitMs = limitResetSeconds * 1000;
      console.log(`Approaching limit. Waiting for ${waitMs}ms`);
      await delay(waitMs);
    }

    const concurrency = limitRemaining < 2 ? 1 : limitRemaining;
    console.log({ limitRemaining, concurrency, limitResetSeconds });
    const batch = pageNumbers.slice(
      currentPageIndex,
      currentPageIndex + concurrency
    );

    const urls = batch.map((page) => getUrl(page, PAGE_SIZE));
    const responses = await fetchWithThrottling(REQUEST_CONFIG, ...urls);

    const minLimit = responses.reduce(
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

    limitRemaining = minLimit.limitRemaining;
    limitResetSeconds = minLimit.limitResetSeconds;

    for (const { stream } of responses) {
      await pipelineAsync(stream, parser(), pass, { end: false }).catch(
        (error) => {
          console.error("Pipeline error:", error);
          pass.destroy(error);
          throw error;
        }
      );
    }

    currentPageIndex += concurrency;
  }
}

export const getCandidates = async (res: Response): Promise<void> => {
  const { pass, jsonToCsv } = createOutputPipeline(res);

  const [{ stream: firstPageStream, headers }] = await fetchWithThrottling(
    REQUEST_CONFIG,
    getUrl(1, PAGE_SIZE)
  );

  await pipelineAsync(firstPageStream, parser(), pass, { end: false }).catch(
    (error) => {
      console.error("Pipeline error:", error);
      pass.destroy(error);
      throw error;
    }
  );

  await processPaginatedRequests(jsonToCsv.totalPages, pass, headers);

  pass.end();
};
