import { Request, Response, RequestHandler } from "express";
export const route =
  (
    handler: (req: Request, res: Response) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };
