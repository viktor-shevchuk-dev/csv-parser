import { RequestHandler } from "express";
import PQueue from "p-queue";

import { ctrlWrapper } from "../helpers";
import { getCandidates } from "../services";

const queue = new PQueue({ concurrency: 1 });

const getAll: RequestHandler = async (req, res, next) => {
  await queue.add(async () => {
    await getCandidates(res);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="candidates.csv"'
    );
    res.setHeader("Content-Encoding", "br");
  });
};

export default {
  getAll: ctrlWrapper(getAll),
};
