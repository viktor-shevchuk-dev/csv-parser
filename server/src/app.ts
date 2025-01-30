import express, { ErrorRequestHandler, RequestHandler } from "express";
import logger from "morgan";
import cors from "cors";
import "dotenv/config";

import candidatesRouter from "./routes/api/candidates";

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());

app.use("/api/candidates", candidatesRouter);

const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ message: "Not Found" });
};
app.use(notFoundHandler);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const { status = 500, message = "Server Error" } = err;
  res.status(status).json({ message });
};
app.use(errorHandler);

export default app;
