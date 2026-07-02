import { Request, Response, NextFunction } from "express";

export function jwtAuthStub(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  req.headers.authorization = authHeader;
  next();
}
