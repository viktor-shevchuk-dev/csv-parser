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

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pass = new PassThrough({ objectMode: true });
    const js2scv = new CandidatesToCsvTransform();
    pass.setMaxListeners(0);
    const monitor = new Monitor();

    pipelineAsync(
      pass,
      streamValues(),
      monitor,
      js2scv,
      csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
      createBrotliCompress(),
      res
    ).catch((err) => {
      console.error("Main pipeline error:", err);
    });

    const { nodeStream: firstPageResponse, rateLimit } =
      await fetchWithThrottling(getUrl(1, PAGE_SIZE), REQUEST_CONFIG);

    await pipelineAsync(firstPageResponse, parser(), pass, {
      end: false,
    }).catch((err) => {
      console.error("First page pipeline error:", err);
    });

    const { pageCount } = js2scv;
    const pageCountTest = 1;
    const pageNumbers = Array.from({ length: pageCount - 1 }, (_, i) => i + 2);

    const concurrency = Number(rateLimit);
    const concurrencyTest = 1;

    for (let i = 0; i < pageNumbers.length; i += concurrency) {
      const batch = pageNumbers.slice(i, i + concurrency);

      const responses = await Promise.all(
        batch.map((page) =>
          fetchWithThrottling(getUrl(page, PAGE_SIZE), REQUEST_CONFIG)
        )
      );

      for (const { nodeStream: res } of responses) {
        await pipelineAsync(res, parser(), pass, {
          end: false,
        }).catch((err) => console.error("Batch page pipeline error:", err));
      }
    }

    pass.end();

    // pipelineAsync(
    //   pass,
    //   streamValues(),
    //   new CandidatesToCsvTransform(),
    //   csvWriter({ headers: CSV_HEADERS, sendHeaders: true }),
    //   createBrotliCompress(),
    //   res
    // );

    // try {
    //   let page = 1;
    //   // do {
    //   const pageStream = await fetchWithThrottling(
    //     getUrl(page, 1),
    //     REQUEST_CONFIG
    //   );
    //   await pipelineAsync(pageStream, parser(), pass, { end: false });
    //   page++;
    //   // } while (CandidatesToCsvTransform.next);
    // } catch (error) {
    //   pass.destroy(error as Error);
    //   next(error);
    // } finally {
    //   pass.end();
    // }
  } catch (error) {
    next(error);
  }
};
