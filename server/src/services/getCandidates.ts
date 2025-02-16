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
    // pass.setMaxListeners(0);

    const pipelinePromise = pipelineAsync(
      pass,
      streamValues(),
      new CandidatesToCsvTransform(),
      csvWriter({ headers: csvHeaders, sendHeaders: true }),
      createBrotliCompress(),
      res
    );

    try {
      let page = 1;
      while (true) {
        const pageStream = await fetchWithThrottling(
          getUrl(page),
          requestConfig
        );
        await pipelineAsync(pageStream, parser(), pass, { end: false });

        if (CandidatesToCsvTransform.isLastPageProcessed) break;

        page++;
      }
    } catch (error) {
      pass.destroy(error as Error);
    } finally {
      pass.end();
    }

    await pipelinePromise;
  } catch (error) {
    next(error);
  }
};
