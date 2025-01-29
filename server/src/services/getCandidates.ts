import { Response, NextFunction } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline, PassThrough } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
const pipelineAsync = promisify(pipeline);
import zlib from "zlib";

import {
  getUrl,
  CandidatesToCsvTransform,
  CompressionStream,
  fetchWithThrottling,
} from "../helpers";
import { csvHeaders, axiosConfig } from "../config";

async function* fetchAllPages() {
  for (let page = 1; page <= Number.MAX_SAFE_INTEGER; page++) {
    const { data } = await fetchWithThrottling(getUrl(page), axiosConfig);
    // data is a ReadableStream (the JSON stream from axios)
    yield data;

    if (CandidatesToCsvTransform.isLastPageProcessed) {
      break;
    }
  }
}

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pass = new PassThrough({ objectMode: true });

    (async () => {
      try {
        for await (const pageStream of fetchAllPages()) {
          await pipelineAsync(pageStream, parser(), pass, { end: false });
        }
      } catch (err) {
        pass.destroy(err as Error);
      } finally {
        pass.end();
      }
    })();

    await pipelineAsync(
      pass,
      streamValues(),
      new CandidatesToCsvTransform(),
      csvWriter({ headers: csvHeaders, sendHeaders: true }),
      zlib.createBrotliCompress(),
      res
    );

    res.end();
  } catch (error) {
    next(error);
  }
};
