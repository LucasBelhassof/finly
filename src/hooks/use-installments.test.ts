import { describe, expect, it } from "vitest";

import { installmentsOverviewQueryKey } from "./use-installments";

describe("installmentsOverviewQueryKey", () => {
  it("includes search in the query key", () => {
    expect(
      installmentsOverviewQueryKey({
        categoryId: "2",
        search: "visa",
        purchaseStart: "2026-04-01",
        purchaseEnd: "2026-04-30",
      }),
    ).toEqual([
      "installments",
      "overview",
      "all",
      "2",
      "visa",
      "all",
      "min:any",
      "max:any",
      "count-mode:all",
      "count-value:any",
      "2026-04-01",
      "2026-04-30",
      "smart",
      "desc",
    ]);
  });
});
