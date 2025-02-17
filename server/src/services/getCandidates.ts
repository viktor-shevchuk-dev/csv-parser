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
} from "../helpers";
import { csvHeaders, requestConfig } from "../config";

const pipelineAsync = promisify(pipeline);

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pass = new PassThrough({ objectMode: true });
    const js2scv = new CandidatesToCsvTransform();

    pipelineAsync(
      pass,
      streamValues(),
      js2scv,
      csvWriter({ headers: csvHeaders, sendHeaders: true }),
      createBrotliCompress(),
      res
    ).catch((err) => {
      console.error("Main pipeline error:", err);
    });

    const { nodeStream: firstPageResponse, rateLimit } =
      await fetchWithThrottling(getUrl(1, 30), requestConfig);

    await pipelineAsync(firstPageResponse, parser(), pass, {
      end: false,
    }).catch((err) => {
      console.error("First page pipeline error:", err);
    });

    const pageNumbers = Array.from(
      { length: js2scv.pageCount - 1 },
      (_, i) => i + 2
    );
    const responses = await Promise.all(
      pageNumbers.map((page) =>
        fetchWithThrottling(getUrl(page, 30), requestConfig)
      )
    );
    for (const { nodeStream: res } of responses) {
      await pipelineAsync(res, parser(), pass, {
        end: false,
      }).catch((err) => {
        console.error("subs page pipeline error:", err);
      });
    }

    pass.end();

    // const pass = new PassThrough({ objectMode: true });
    // pass.setMaxListeners(0);

    // pipelineAsync(
    //   pass,
    //   streamValues(),
    //   new CandidatesToCsvTransform(),
    //   csvWriter({ headers: csvHeaders, sendHeaders: true }),
    //   createBrotliCompress(),
    //   res
    // );

    // try {
    //   let page = 1;
    //   // do {
    //   const pageStream = await fetchWithThrottling(
    //     getUrl(page, 1),
    //     requestConfig
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
