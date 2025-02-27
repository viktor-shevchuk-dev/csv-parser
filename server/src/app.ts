import express, { ErrorRequestHandler, RequestHandler } from "express";
import logger from "morgan";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import candidatesRouter from "./routes/api/candidates";

const requiredEnv = ["API_KEY", "BASE_URL", "API_VERSION"];
requiredEnv.forEach((env) => {
  if (!process.env[env]) throw new Error(`Missing ${env} environment variable`);
});

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(helmet());
app.use(logger(formatsLogger));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api/", apiLimiter);

app.use("/api/candidates", candidatesRouter);

const healthCheckHandler: RequestHandler = (req, res) => {
  res.status(200).json({ status: "ok" });
};
app.get("/api/health", healthCheckHandler);

const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ message: "Not Found" });
};
app.use(notFoundHandler);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const { stack, status = 500, message = "Server Error" } = err;
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== "production" && { stack }),
  });
};
app.use(errorHandler);

export default app;
