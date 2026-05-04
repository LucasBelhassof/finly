import type { RequestAuthContext } from "../modules/auth/types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuthContext;
      requestId?: string;
    }
  }
}

export {};
