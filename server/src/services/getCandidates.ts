import { Response, NextFunction } from "express";
import { parser } from "stream-json";
import { streamValues } from "stream-json/streamers/StreamValues";
import { pipeline } from "stream";
import csvWriter from "csv-write-stream";
import { promisify } from "util";
const pipelineAsync = promisify(pipeline);

import {
  getUrl,
  CandidatesToCsvTransform,
  fetchWithThrottling,
} from "../helpers";
import { csvHeaders, axiosConfig } from "../config";

export const getCandidates = async (
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    for (let page = 1; page <= Number.MAX_SAFE_INTEGER; page++) {
      const { data: jsonStream } = await fetchWithThrottling(
        getUrl(page),
        axiosConfig
      );

      await pipelineAsync(
        jsonStream,
        parser(),
        streamValues(),
        new CandidatesToCsvTransform(),
        csvWriter({ headers: csvHeaders, sendHeaders: page === 1 }),
        res,
        { end: false }
      );

      if (CandidatesToCsvTransform.isLastPageProcessed) break;
    }

    res.end();
  } catch (error) {
    next(error);
  }
};
