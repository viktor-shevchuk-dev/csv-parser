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
    const csvTransform = new CandidatesToCsvTransform();
    pass.setMaxListeners(0);
    const monitor = new Monitor();

    pass.on("error", (err) => {
      console.log({ err }, "pass error");
    });

    let outputPipelinePromise;
    try {
      outputPipelinePromise = pipelineAsync(
        pass,
        streamValues(),
        monitor,
        csvTransform,
        csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
        createBrotliCompress(),
        res
      );
    } catch (error) {
      console.error("Main pipeline error:", error);
      pass.destroy(error as Error);
      throw error;
    }

    const {
      nodeStream: firstPageStream,
      headers: { rateLimit: concurrencyLimit },
    } = await fetchWithThrottling(getUrl(1, PAGE_SIZE), REQUEST_CONFIG);

    try {
      await pipelineAsync(firstPageStream, parser(), pass, {
        end: false,
      });
    } catch (error) {
      console.error("First page pipeline error:", error);
      pass.destroy(error as Error);
      throw error;
    }

    const { PAGE_COUNT } = csvTransform;
    const pageNumbers = Array.from({ length: PAGE_COUNT - 1 }, (_, i) => i + 2);

    let i = 0;
    while (i < pageNumbers.length) {
      const batch = pageNumbers.slice(i, i + concurrencyLimit);
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

      i += concurrencyLimit;
    }

    pass.end();
    await outputPipelinePromise;
  } catch (error) {
    next(error);
  }
};
