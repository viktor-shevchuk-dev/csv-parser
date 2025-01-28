import { RequestHandler } from "express";

import ctrlWrapper from "../helpers/ctrlWrapper";
import getCandidates from "../services/getCandidates";

const getAll: RequestHandler = async (req, res, next) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="candidates.csv"');
  await getCandidates(res, next);
};

export default {
  getAll: ctrlWrapper(getAll),
};
