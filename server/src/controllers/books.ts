import { RequestHandler } from "express";
import { Transform } from "json2csv";
import fs from "fs";
import { Readable } from "stream";

import ctrlWrapper from "../helpers/ctrlWrapper";
import getCandidates from "../services/getCandidates";

const getAll: RequestHandler = async (req, res, next) => {
  // jsonStream.data.on("data", (chunk) => {
  //   const jsonData = JSON.parse(chunk.toString());
  //   console.log("Parsed JSON:", jsonData);
  // });

  const opts = {
    objectMode: true,
    fields: [
      {
        label: "candidate_id",
        value: "data[0].id",
      },
      {
        label: "first_name",
        value: "data[0].attributes['first-name']",
      },
      {
        label: "last_name",
        value: "data[0].attributes['last-name']",
      },
      {
        label: "email",
        value: "data[0].attributes.email",
      },
      {
        label: "job_application_id",
        value: "data[0].relationships['job-applications'].data[0].id",
      },
      {
        label: "job_application_created_at",
        value: "included[0].attributes['created-at']",
      },
    ],
  };

  const json2csv = new Transform(opts);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="candidates.csv"');
  const jsonStream = await getCandidates(res);

  // json2csv
  //   .on("header", (header) => console.log({ header }))
  //   .on("line", (line) => console.log({ line }))
  //   .on("error", (err) => console.log({ err }));

  // jsonStream.pipe(res, { end: true });
  // res.json(jsonStream.data);
  // jsonStream.data.pipe(res);
};

export default {
  getAll: ctrlWrapper(getAll),
};
