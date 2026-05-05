import type { AuthUser } from "../modules/auth/types.js";
import { HttpError } from "./errors.js";

export function requirePremium(user: AuthUser | null | undefined, feature: string) {
  if (user?.isPremium) {
    return;
  }

  throw new HttpError(402, "premium_required", "Este recurso está disponível apenas na versão Premium.", { feature });
}
