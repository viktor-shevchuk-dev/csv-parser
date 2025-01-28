import { RequestHandler } from "express";

export const ctrlWrapper = (ctrl: RequestHandler) => {
  const func: RequestHandler = async (req, res, next) => {
    try {
      await ctrl(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  return func;
};
