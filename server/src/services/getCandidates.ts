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

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pass = new PassThrough({ objectMode: true });
    const js2scv = new CandidatesToCsvTransform();
    pass.setMaxListeners(0);
    const monitor = new Monitor();

    pass.on("error", (err) => {
      console.log({ err }, "pass error");
    });

    let mainPipelinePromise;
    try {
      mainPipelinePromise = pipelineAsync(
        pass,
        streamValues(),
        monitor,
        js2scv,
        csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
        createBrotliCompress(),
        res
      );
    } catch (error) {
      console.error("Main pipeline error:", error);
      pass.destroy(error as Error);
      throw error;
    }

    const { nodeStream: firstPageResponse, rateLimit: CONCURRENCY } =
      await fetchWithThrottling(getUrl(1, PAGE_SIZE), REQUEST_CONFIG);

    try {
      await pipelineAsync(firstPageResponse, parser(), pass, {
        end: false,
      });
    } catch (error) {
      console.error("First page pipeline error:", error);
      pass.destroy(error as Error);
      throw error;
    }

    const { PAGE_COUNT } = js2scv;
    const pageNumbers = Array.from({ length: PAGE_COUNT - 1 }, (_, i) => i + 2);

    const CONCURRENCY_TEST = 1;

    for (let i = 0; i < pageNumbers.length; i += CONCURRENCY_TEST) {
      const batch = pageNumbers.slice(i, i + CONCURRENCY_TEST);

      const responses = await Promise.all(
        batch.map((page) =>
          fetchWithThrottling(getUrl(page, PAGE_SIZE), REQUEST_CONFIG)
        )
      );

      for (const { nodeStream: res } of responses) {
        try {
          await pipelineAsync(res, parser(), pass, {
            end: false,
          });
        } catch (error) {
          console.error("Batch page pipeline error:", error);
          pass.destroy(error as Error);
          throw error;
        }
      }
    }

    pass.end();
    await mainPipelinePromise;
  } catch (error) {
    next(error);
  }
};
