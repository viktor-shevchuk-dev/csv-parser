import { Response, NextFunction } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
import { createBrotliCompress } from "zlib";
const pipelineAsync = promisify(pipeline);

import { CandidatesToCsvTransform, fetchCandidates } from "../helpers";
import { csvHeaders } from "../config";

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pass = new PassThrough({ objectMode: true });
    // pass.setMaxListeners(0);

    (async () => {
      try {
        for await (const pageStream of fetchCandidates()) {
          await pipelineAsync(pageStream, parser(), pass, { end: false });
        }
      } catch (error) {
        pass.destroy(error as Error);
      } finally {
        pass.end();
      }
    })();

    await pipelineAsync(
      pass,
      streamValues(),
      new CandidatesToCsvTransform(),
      csvWriter({ headers: csvHeaders, sendHeaders: true }),
      createBrotliCompress(),
      res
    );
  } catch (error) {
    next(error);
  }
};
