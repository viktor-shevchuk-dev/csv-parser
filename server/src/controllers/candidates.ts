import { RequestHandler } from "express";

import { ctrlWrapper } from "../helpers";
import { getCandidates } from "../services";

const getAll: RequestHandler = async (req, res, next) => {
  res.setHeader("Content-Encoding", "br");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="candidates.csv"');
  await getCandidates(res, next);
};

export default {
  getAll: ctrlWrapper(getAll),
};
