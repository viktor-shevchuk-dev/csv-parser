import { RequestHandler } from "express";

import ctrlWrapper from "../helpers/ctrlWrapper";

const books = [
  { title: "1984", id: "1" },
  { title: "Crime and Punishment", id: "2" },
];

const getAll: RequestHandler = async (req, res, next) => {
  res.json(books);
};

export default {
  getAll: ctrlWrapper(getAll),
};
